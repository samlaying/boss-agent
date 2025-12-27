package com.getjobs.worker.boss;

import com.getjobs.application.entity.AiEntity;
import com.getjobs.application.service.AiService;
import com.getjobs.application.service.BossService;
import com.getjobs.worker.utils.Job;
import com.getjobs.worker.utils.JobUtils;
import com.getjobs.worker.utils.PlaywrightUtil;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.Response;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.context.annotation.Scope;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

import static com.getjobs.worker.boss.Locators.*;


/**
 * @author loks666
 * 项目链接: <a href=
 * "https://github.com/loks666/get_jobs">https://github.com/loks666/get_jobs</a>
 * Boss直聘自动投递
 */
@Slf4j
@Component
@Scope("prototype")
@RequiredArgsConstructor
public class Boss {

    @Setter
    private Page page;
    @Setter
    private BossConfig config;
    private final BossService bossService;
    private final AiService aiService;
    private Set<String> blackCompanies;
    private Set<String> blackRecruiters;
    private Set<String> blackJobs;
    // 记录 encryptId -> encryptUserId 的映射，用于后续更新投递状态
    private final ConcurrentMap<String, String> encryptIdToUserId = new ConcurrentHashMap<>();
    @Setter
    private ProgressCallback progressCallback;
    @Setter
    private Supplier<Boolean> shouldStopCallback;

    private final List<Job> resultList = new ArrayList<>();

    /**
     * 进度回调接口
     */
    @FunctionalInterface
    public interface ProgressCallback {
        void accept(String message, Integer current, Integer total);
    }

    // 通过 Lombok @RequiredArgsConstructor 使用构造器注入 bossService 与 aiService

    public void prepare() {
        // 调整 boss_data 表结构：将 encrypt_id、encrypt_user_id 前置
        try { bossService.ensureBossDataColumnOrder(); } catch (Throwable ignore) {}
        // 从数据库加载黑名单
        this.blackCompanies = bossService.getBlackCompanies();
        this.blackRecruiters = bossService.getBlackRecruiters();
        this.blackJobs = bossService.getBlackJobs();

        log.info("黑名单加载完成: 公司({}) 招聘者({}) 职位({})",
                blackCompanies != null ? blackCompanies.size() : 0,
                blackRecruiters != null ? blackRecruiters.size() : 0,
                blackJobs != null ? blackJobs.size() : 0);
        // 不在页面初始化阶段入库，仅用于后续点击卡片时按需入库
    }

    /**
     * 安全滚动页面，包含随机延迟和异常处理
     * @return 如果页面上下文依然有效返回 true，否则返回 false
     */
    private boolean safeScrollAndDelay(Page page) {
        try {
            // 1. 检查页面是否关闭
            if (page.isClosed()) {
                log.warn("Boss直聘页面已关闭，停止滚动");
                return false;
            }

            // 2. 检查是否被重定向到了登录页或验证页
            String currentUrl = page.url();
            if (currentUrl.contains("login") || currentUrl.contains("verify") || currentUrl.contains("captcha")) {
                log.error("Boss直聘检测到自动化行为，已跳转至验证/登录页: {}", currentUrl);
                return false;
            }

            // 3. 执行拟人化滚动 (随机高度 300-800px，模拟不同滚动幅度)
            Random random = new Random();
            int scrollAmount = 300 + random.nextInt(500);

            // 偶尔使用不同的滚动模式
            if (random.nextInt(10) == 0) {
                // 10% 概率使用小幅滚动
                scrollAmount = 100 + random.nextInt(200);
            } else if (random.nextInt(20) == 0) {
                // 5% 概率使用大幅滚动
                scrollAmount = 800 + random.nextInt(400);
            }

            page.evaluate("window.scrollBy(0, " + scrollAmount + ")");

            // 4. 随机等待 (1.5秒 - 4秒)，模拟人类浏览
            int delay = 1500 + random.nextInt(2500);

            // 偶尔添加更长的停顿，模拟用户阅读内容
            if (random.nextInt(15) == 0) {
                delay += 2000 + random.nextInt(3000); // 额外2-5秒
            }

            Thread.sleep(delay);

            return true;
        } catch (com.microsoft.playwright.PlaywrightException e) {
            if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                log.error("页面上下文已销毁（可能是页面自动刷新或跳转），停止当前批次操作");
                return false;
            }
            log.warn("滚动时发生轻微错误: {}", e.getMessage());
            return true; // 其他错误尝试继续
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("滚动被中断");
            return false;
        } catch (Exception e) {
            log.warn("滚动时发生未知错误: {}", e.getMessage());
            return true; // 未知错误尝试继续
        }
    }

    /**
     * 执行投递
     */
    public int execute() {
        for (String cityCode : config.getCityCode()) {
            if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                progressCallback.accept("用户取消投递", 0, 0);
                break;
            }
            postJobByCity(cityCode);
            if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                progressCallback.accept("用户取消投递", 0, 0);
                break;
            }
        }
        return resultList.size();
    }

    /**
     * 获取结果列表
     */
    public List<Job> getResultList() {
        return new ArrayList<>(resultList);
    }

    /**
     * 更新黑名单（从聊天记录中）
     */
    public Map<String, Set<String>> updateBlacklistFromChats() {
        page.navigate("https://www.zhipin.com/web/geek/chat");
        PlaywrightUtil.sleep(3);

        int newBlacklistCount = 0;
        boolean shouldBreak = false;
        while (!shouldBreak) {
            try {
                Locator bottomLocator = page.locator(FINISHED_TEXT);
                if (bottomLocator.count() > 0 && "没有更多了".equals(bottomLocator.textContent())) {
                    shouldBreak = true;
                }
            } catch (Exception ignore) {
            }

            Locator items = page.locator(CHAT_LIST_ITEM);
            int itemCount = items.count();

            for (int i = 0; i < itemCount; i++) {
                try {
                    Locator companyElements = page.locator(COMPANY_NAME_IN_CHAT);
                    Locator messageElements = page.locator(LAST_MESSAGE);

                    if (i >= companyElements.count() || i >= messageElements.count()) {
                        break;
                    }

                    String companyName = null;
                    String message = null;
                    int retryCount = 0;

                    while (true) {
                        try {
                            companyName = companyElements.nth(i).textContent();
                            message = messageElements.nth(i).textContent();
                            break;
                        } catch (Exception e) {
                            retryCount++;
                            if (retryCount >= 2) {
                                log.info("尝试获取元素文本2次失败，放弃本次获取");
                                break;
                            }
                            log.info("页面元素已变更，正在重试第{}次获取元素文本...", retryCount);
                            PlaywrightUtil.sleep(1);
                        }
                    }

                    if (companyName != null && message != null) {
                        boolean match = message.contains("不") || message.contains("感谢") || message.contains("但")
                                || message.contains("遗憾") || message.contains("需要本") || message.contains("对不");
                        boolean nomatch = message.contains("不是") || message.contains("不生");
                        if (match && !nomatch) {
                            if (blackCompanies.stream().anyMatch(companyName::contains)) {
                                continue;
                            }
                            companyName = companyName.replaceAll("\\.{3}", "");
                            if (companyName.matches(".*(\\p{IsHan}{2,}|[a-zA-Z]{4,}).*")) {
                                blackCompanies.add(companyName);
                                // 保存到数据库
                                bossService.addBlacklist("company", companyName);
                                newBlacklistCount++;
                                log.info("黑名单公司：【{}】，信息：【{}】", companyName, message);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("寻找黑名单公司异常...", e);
                }
            }

            try {
                Locator scrollElement = page.locator(SCROLL_LOAD_MORE);
                if (scrollElement.count() > 0) {
                    scrollElement.scrollIntoViewIfNeeded();
                } else {
                    page.evaluate("window.scrollTo(0, document.body.scrollHeight);");
                }
            } catch (Exception e) {
                log.error("滚动元素出错", e);
                break;
            }
        }
        log.info("黑名单公司数量：{}，本次新增：{}", (blackCompanies != null ? blackCompanies.size() : 0), newBlacklistCount);

        Map<String, Set<String>> result = new HashMap<>();
        result.put("blackCompanies", new HashSet<>(blackCompanies != null ? blackCompanies : Collections.emptySet()));
        result.put("blackRecruiters", new HashSet<>(blackRecruiters != null ? blackRecruiters : Collections.emptySet()));
        result.put("blackJobs", new HashSet<>(blackJobs != null ? blackJobs : Collections.emptySet()));
        return result;
    }

    /**
     * 智能导航到指定URL
     * 在CDP模式下，如果已在目标URL则避免刷新
     */
    private void smartNavigate(String targetUrl, String description) {
        // 统一处理目标URL的“基础部分”（去掉查询参数和锚点）
        String baseTarget = targetUrl.split("\\?")[0].split("#")[0];

        try {
            if (page.isClosed()) {
                log.error("Boss 页面已关闭，无法导航到{}", description);
                throw new RuntimeException("Boss页面已关闭，导航失败");
            }
        } catch (Exception e) {
            log.error("检测Boss页面状态失败: {}", e.getMessage());
            throw new RuntimeException("Boss页面状态异常，导航失败", e);
        }

        try {
            String currentUrl = page.url();

            // 检查是否已经在目标页面
            if (currentUrl != null && currentUrl.contains(baseTarget)) {
                log.info("已在{}页面，跳过导航", description);

                // 即使已在目标页面，也确保关键元素已加载
                try {
                    page.waitForSelector("//ul[contains(@class, 'rec-job-list')]",
                        new Page.WaitForSelectorOptions().setTimeout(10_000));
                } catch (Exception e) {
                    log.warn("等待列表容器超时，尝试刷新页面: {}", e.getMessage());
                    try {
                        page.reload(new Page.ReloadOptions()
                            .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED)
                            .setTimeout(15_000));
                    } catch (Exception reloadEx) {
                        log.warn("刷新{}页面失败: {}", description, reloadEx.getMessage());
                    }
                }
                return;
            }
        } catch (Exception e) {
            log.warn("获取当前Boss页面URL失败，直接尝试导航: {}", e.getMessage());
        }

        int maxRetries = 3;
        boolean navigateSuccess = false;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                log.info("导航到{}页面(第{}次尝试): {}", description, attempt, targetUrl);
                page.navigate(targetUrl, new Page.NavigateOptions()
                    .setWaitUntil(com.microsoft.playwright.options.WaitUntilState.DOMCONTENTLOADED)
                    .setTimeout(60_000));
                navigateSuccess = true;
                break;
            } catch (Exception e) {
                String msg = e.getMessage();
                log.warn("导航到{}页面失败(第{}次): {}", description, attempt, msg);

                // Playwright在CDP/并发场景下可能抛出 "Object doesn't exist" 等异常，
                // 但页面实际上已经完成导航，这里尝试通过URL兜底判断
                boolean pageAccessible = false;
                try {
                    String urlAfterError = page.url();
                    pageAccessible = urlAfterError != null && urlAfterError.contains(baseTarget);
                    if (pageAccessible) {
                        log.info("导航异常后检测到已在目标页面，视为成功: {}", urlAfterError);
                    }
                } catch (Exception ignored) {
                }

                if (pageAccessible) {
                    navigateSuccess = true;
                    break;
                }

                if (attempt < maxRetries) {
                    try {
                        Thread.sleep(2000L * attempt);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        if (!navigateSuccess) {
            log.error("多次尝试后仍无法导航到{}页面: {}", description, targetUrl);
            throw new RuntimeException("导航失败");
        }
    }

    private void postJobByCity(String cityCode) {
        String searchUrl = getSearchUrl(cityCode);
        for (String keyword : config.getKeywords()) {
            // 检查是否需要停止
            if (shouldStopCallback.get()) {
                progressCallback.accept("用户取消投递", 0, 0);
                return;
            }

            int postCount = 0;
            // 使用 URLEncoder 对关键词进行编码
            String encodedKeyword = URLEncoder.encode(keyword, StandardCharsets.UTF_8);

            String url = searchUrl + "&query=" + encodedKeyword;

            // 使用智能导航，避免CDP模式下不必要的刷新
            smartNavigate(url, "职位搜索-" + keyword);

            // 等待列表容器出现，确保页面完成首屏渲染
            try {
                page.waitForSelector("//ul[contains(@class, 'rec-job-list')]", new Page.WaitForSelectorOptions().setTimeout(60_000));
            } catch (Exception e) {
                log.warn("等待列表容器超时，尝试继续执行: {}", e.getMessage());
                // 不抛出异常，尝试继续执行
            }

            // 1. 基于 footer 出现滚动到底，确保加载全部岗位
            int lastCount = -1;
            int stableTries = 0;
            for (int i = 0; i < 5000; i++) { // 最多尝试约120次，避免死循环
                // 停止检查：滚动加载过程中也要及时响应
                if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                    progressCallback.accept("用户取消投递", 0, 0);
                    return;
                }

                // 使用安全的滚动方法
                boolean isSafe = safeScrollAndDelay(page);
                if (!isSafe) {
                    log.error("检测到页面异常，停止滚动以防止持续刷新/报错");
                    progressCallback.accept("页面异常，停止任务", 0, 0);
                    return;
                }

                // 检查是否到达页面底部（使用 try-catch 包裹）
                try {
                    Locator footer = page.locator("div#footer, #footer");
                    if (footer.count() > 0 && footer.first().isVisible()) {
                        log.info("已到达页面底部，停止滚动");
                        break; // 到达页面底部
                    }
                } catch (com.microsoft.playwright.PlaywrightException e) {
                    if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                        log.error("检查footer时页面刷新，终止当前任务");
                        progressCallback.accept("页面刷新，停止任务", 0, 0);
                        return;
                    }
                    log.warn("检查footer时发生错误: {}", e.getMessage());
                }

                // 获取卡片数量变化，判断是否需要强制触底（使用 try-catch 包裹）
                try {
                    Locator cardsProbe = page.locator("//ul[contains(@class, 'rec-job-list')]//li[contains(@class, 'job-card-box')]");
                    int currentCount = cardsProbe.count();
                    if (currentCount == lastCount) {
                        stableTries++;
                    } else {
                        stableTries = 0;
                    }
                    lastCount = currentCount;

                    if (stableTries >= 3) { // 连续多次无新增，则强制触底一次
                        try {
                            page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)");
                        } catch (com.microsoft.playwright.PlaywrightException e) {
                            if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                                log.error("强制触底时页面刷新，终止当前任务");
                                progressCallback.accept("页面刷新，停止任务", 0, 0);
                                return;
                            }
                        }
                        // 触底不再等待，继续检测 footer 出现
                    }
                } catch (com.microsoft.playwright.PlaywrightException e) {
                    if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                        log.error("获取卡片数量时页面刷新，终止当前任务");
                        progressCallback.accept("页面刷新，停止任务", 0, 0);
                        return;
                    }
                    log.warn("获取卡片数量时发生错误: {}", e.getMessage());
                }
            }
            // 统计最终岗位数量（添加异常处理）
            int loadedCount = 0;
            try {
                Locator cardsFinal = page.locator("//ul[contains(@class, 'rec-job-list')]//li[contains(@class, 'job-card-box')]");
                loadedCount = cardsFinal.count();
                log.info("【{}】岗位已全部加载，总数:{}", keyword, loadedCount);
                progressCallback.accept("岗位加载完成：" + keyword, 0, loadedCount);
            } catch (com.microsoft.playwright.PlaywrightException e) {
                if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                    log.error("统计岗位数量时页面刷新，终止当前任务");
                    progressCallback.accept("页面刷新，停止任务", 0, 0);
                    return;
                }
                log.warn("统计岗位数量时发生错误: {}", e.getMessage());
                // 设置一个默认值，继续执行
                loadedCount = 0;
                progressCallback.accept("岗位加载完成（部分）：" + keyword, 0, loadedCount);
            }

            // 2. 回到页面顶部（添加异常处理）
            try {
                page.evaluate("window.scrollTo(0, 0);");
                PlaywrightUtil.sleep(1);
            } catch (com.microsoft.playwright.PlaywrightException e) {
                if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                    log.error("回到顶部时页面刷新，终止当前任务");
                    progressCallback.accept("页面刷新，停止任务", 0, 0);
                    return;
                }
                log.warn("回到顶部时发生错误: {}", e.getMessage());
            }

            // 3. 逐个遍历所有岗位（添加异常处理）
            Locator cards = null;
            int count = 0;
            try {
                cards = page.locator("//ul[contains(@class, 'rec-job-list')]//li[contains(@class, 'job-card-box')]");
                count = cards.count();
                log.info("开始处理 {} 个岗位卡片", count);
            } catch (com.microsoft.playwright.PlaywrightException e) {
                if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                    log.error("获取岗位列表时页面刷新，终止当前任务");
                    progressCallback.accept("页面刷新，停止任务", 0, 0);
                    return;
                }
                log.warn("获取岗位列表时发生错误: {}", e.getMessage());
                progressCallback.accept("获取岗位列表失败", 0, 0);
                return;
            }

            for (int i = 0; i < count; i++) {
                // 检查是否需要停止
                if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                    progressCallback.accept("用户取消投递", i, count);
                    return;
                }

                // 在每次操作前检查页面状态
                boolean isSafe = safeScrollAndDelay(page);
                if (!isSafe) {
                    log.error("遍历岗位时检测到页面异常，停止任务");
                    progressCallback.accept("页面异常，停止任务", i, count);
                    return;
                }

                // 重新获取卡片，避免元素过期
                Response detailResp = null;
                try {
                    cards = page.locator("//ul[contains(@class, 'rec-job-list')]//li[contains(@class, 'job-card-box')]");
                    // 在点击卡片时同步等待岗位详情接口返回，随后解析并入库
                    try {
                        if (i == 0 && count > 1) {
                            // 第一个卡片默认展开不会触发请求：先切到第二个，再切回第一个，并在返回第一个时监听响应
                            final Locator secondCard = cards.nth(1);
                            secondCard.click();
                            PlaywrightUtil.sleep(1);
                            final Locator firstCard = cards.nth(0);
                            detailResp = page.waitForResponse(r -> {
                                try {
                                    return r.url() != null && r.url().contains("/wapi/zpgeek/job/detail.json")
                                            && "GET".equalsIgnoreCase(r.request().method());
                                } catch (Throwable ignore) { return false; }
                            }, firstCard::click);
                        } else {
                            final Locator cardToClick = cards.nth(i);
                            detailResp = page.waitForResponse(r -> {
                                try {
                                    return r.url() != null && r.url().contains("/wapi/zpgeek/job/detail.json")
                                            && "GET".equalsIgnoreCase(r.request().method());
                                } catch (Throwable ignore) { return false; }
                            }, cardToClick::click);
                        }
                    } catch (com.microsoft.playwright.PlaywrightException e) {
                        if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                            log.error("点击岗位卡片时页面刷新，终止当前任务");
                            progressCallback.accept("页面刷新，停止任务", i, count);
                            return;
                        }
                        log.warn("点击岗位卡片时发生错误（第{}个）: {}", i + 1, e.getMessage());
                    } catch (Throwable e) {
                        log.warn("点击岗位卡片时发生未知错误（第{}个）: {}", i + 1, e.getMessage());
                    }
                    PlaywrightUtil.sleep(1);
                } catch (com.microsoft.playwright.PlaywrightException e) {
                    if (e.getMessage() != null && e.getMessage().contains("Execution context was destroyed")) {
                        log.error("重新获取卡片时页面刷新，终止当前任务");
                        progressCallback.accept("页面刷新，停止任务", i, count);
                        return;
                    }
                    log.warn("重新获取卡片时发生错误: {}", e.getMessage());
                    continue; // 跳过当前卡片，继续下一个
                }

                // 统一从请求返回的 JSON 中获取数据并做过滤
                String jobName = null;
                String jobSalary = null;
                java.util.List<String> tags = new java.util.ArrayList<>();
                String jobDesc = null;
                String bossName = null;
                String bossActive = null;
                String bossCompany = null;
                String bossJobTitle = null;

                if (detailResp != null) {
                    try {
                        String body = detailResp.text();
                        // 保存原始 JSON 便于调试
                        appendRawJson(body);
                        // 解析并入库（仅在点击卡片触发时执行）
                        processJobDetailJsonAndInsert(body);

                        // 从 JSON 构建用于投递与过滤的字段
                        org.json.JSONObject root = new org.json.JSONObject(body);
                        org.json.JSONObject zpData = root.optJSONObject("zpData");
                        org.json.JSONObject jobInfo = zpData != null ? zpData.optJSONObject("jobInfo") : null;
                        org.json.JSONObject brand = zpData != null ? zpData.optJSONObject("brandComInfo") : null;
                        org.json.JSONObject boss = zpData != null ? zpData.optJSONObject("bossInfo") : null;

                        if (jobInfo != null) {
                            jobName = jobInfo.optString("jobName", "");
                            jobSalary = jobInfo.optString("salaryDesc", "");
                            String city = jobInfo.optString("locationName", "");
                            String exp = jobInfo.optString("experienceName", "");
                            String deg = jobInfo.optString("degreeName", "");
                            if (!city.isEmpty()) tags.add(city);
                            if (!exp.isEmpty()) tags.add(exp);
                            if (!deg.isEmpty()) tags.add(deg);
                            jobDesc = jobInfo.optString("postDescription", "");
                        }

                        if (boss != null) {
                            bossName = boss.optString("name", "");
                            bossActive = boss.optString("activeTimeDesc", "");
                            bossJobTitle = boss.optString("title", "");
                        }

                        if (brand != null) {
                            bossCompany = brand.optString("brandName", "");
                        }
                    } catch (Throwable e) {
                        log.debug("点击卡片后解析岗位详情用于过滤失败：{}", e.getMessage());
                    }
                }

                // 过滤（全部基于 JSON 字段），并输出过滤原因
                if (jobName != null && blackJobs != null && blackJobs.stream().anyMatch(jobName::contains)) {
                    String term = findMatchedTerm(blackJobs, jobName);
                    log.info("被过滤：职位黑名单命中 | 公司：{} | 岗位：{} | 关键词：{}", bossCompany != null ? bossCompany : "", jobName, term != null ? term : "");
                    continue;
                }
                // HR活跃状态过滤：当开启过滤开关且活跃描述包含“年”时，视为不活跃
                boolean hrInactiveByYear = bossActive != null && bossActive.contains("年");
                if (Boolean.TRUE.equals(config.getFilterDeadHR()) && hrInactiveByYear) {
                    log.info("被过滤：HR活跃状态包含‘年’ | 公司：{} | 岗位：{} | 活跃：{}", bossCompany != null ? bossCompany : "", jobName != null ? jobName : "", bossActive);
                    continue;
                }
                if (bossCompany != null && blackCompanies != null && blackCompanies.stream().anyMatch(bossCompany::contains)) {
                    String term = findMatchedTerm(blackCompanies, bossCompany);
                    log.info("被过滤：公司黑名单命中 | 公司：{} | 岗位：{} | 关键词：{}", bossCompany, jobName != null ? jobName : "", term != null ? term : "");
                    continue;
                }
                if (bossJobTitle != null && blackRecruiters != null && blackRecruiters.stream().anyMatch(bossJobTitle::contains)) {
                    String term = findMatchedTerm(blackRecruiters, bossJobTitle);
                    log.info("被过滤：招聘者黑名单命中 | 公司：{} | 岗位：{} | 招聘者：{} | 关键词：{}", bossCompany != null ? bossCompany : "", jobName != null ? jobName : "", bossJobTitle, term != null ? term : "");
                    continue;
                }

                // 创建Job对象（全部基于 JSON 字段）
                Job job = new Job();
                job.setJobName(jobName != null ? jobName : "");
                job.setSalary(jobSalary != null ? jobSalary : "");
                job.setJobArea(String.join(", ", tags));
                job.setCompanyName(bossCompany != null ? bossCompany : "");
                job.setRecruiter(bossName != null ? bossName : "");
                job.setJobInfo(jobDesc != null ? jobDesc : "");

                // 输出
                progressCallback.accept("正在投递：" + jobName, i + 1, count);
                resumeSubmission(keyword, job);
                postCount++;

                // 为避免点击下面的卡片触发页面刷新：在点击5个卡片之后，每次点击后适度下滑
                try {
                    if (i >= 5) {
                        page.evaluate("window.scrollBy(0, 140);");
                        PlaywrightUtil.sleep(1);
                    }
                } catch (Throwable ignore) {}
            }
            log.info("【{}】岗位已投递完毕！已投递岗位数量:{}", keyword, postCount);
        }
    }

    /**
     * 解析岗位详情 JSON 并进行入库与黑名单处理（只在点击卡片时调用）。
     */
    private void processJobDetailJsonAndInsert(String body) {
        if (body == null || body.isEmpty()) return;
        try {
            JSONObject root = new JSONObject(body);
            JSONObject zpData = root.optJSONObject("zpData");
            if (zpData == null) return;

            JSONObject jobInfo = zpData.optJSONObject("jobInfo");
            JSONObject brand = zpData.optJSONObject("brandComInfo");
            JSONObject bossInfo = zpData.optJSONObject("bossInfo");
            if (jobInfo == null) return;

            String encryptId = jobInfo.optString("encryptId", null);
            String encryptUserId = jobInfo.optString("encryptUserId", null);
            if (encryptUserId == null && bossInfo != null) {
                // 兼容部分页面字段落在 bossInfo 内
                encryptUserId = bossInfo.optString("encryptUserId", null);
                if (encryptUserId == null) {
                    // 进一步兼容可能的字段命名
                    encryptUserId = bossInfo.optString("encryptBossId", null);
                }
            }
            if (encryptId != null && encryptUserId != null) {
                encryptIdToUserId.put(encryptId, encryptUserId);
            }

            com.getjobs.application.entity.BossJobDataEntity entity = new com.getjobs.application.entity.BossJobDataEntity();
            entity.setJobName(jobInfo.optString("jobName", null));
            entity.setSalary(jobInfo.optString("salaryDesc", null));
            entity.setLocation(jobInfo.optString("locationName", null));
            entity.setExperience(jobInfo.optString("experienceName", null));
            entity.setDegree(jobInfo.optString("degreeName", null));
            entity.setJobDescription(jobInfo.optString("postDescription", null));
            entity.setRecruitmentStatus(jobInfo.optString("jobStatusDesc", null));
            entity.setCompanyAddress(jobInfo.optString("address", null));
            entity.setEncryptId(encryptId);
            entity.setEncryptUserId(encryptUserId);

            entity.setCompanyName(brand != null ? brand.optString("brandName", null) : null);
            entity.setIndustry(brand != null ? brand.optString("industryName", null) : null);
            entity.setIntroduce(brand != null ? brand.optString("introduce", null) : null);
            entity.setFinancingStage(brand != null ? brand.optString("stageName", null) : null);
            entity.setCompanyScale(brand != null ? brand.optString("scaleName", null) : null);

            entity.setHrName(bossInfo != null ? bossInfo.optString("name", null) : null);
            entity.setHrPosition(bossInfo != null ? bossInfo.optString("title", null) : null);
            entity.setHrActiveStatus(bossInfo != null ? bossInfo.optString("activeTimeDesc", null) : null);

            if (encryptId != null && !encryptId.isEmpty()) {
                entity.setJobUrl("https://www.zhipin.com/job_detail/" + encryptId + ".html");
            }

            // 黑名单处理
            boolean filtered = false;
            String companyName = entity.getCompanyName() != null ? entity.getCompanyName() : "";
            String positionName = entity.getJobName() != null ? entity.getJobName() : "";
            String hrPosition = entity.getHrPosition() != null ? entity.getHrPosition() : "";
            try {
                if (blackCompanies != null && blackCompanies.stream().anyMatch(companyName::contains)) filtered = true;
                if (!filtered && blackJobs != null && blackJobs.stream().anyMatch(positionName::contains)) filtered = true;
                if (!filtered && blackRecruiters != null && blackRecruiters.stream().anyMatch(hrPosition::contains)) filtered = true;
            } catch (Throwable ignore) {}

            // HR活跃状态过滤：开启过滤且活跃描述包含“年”，则标记为已过滤，但仍入库
            if (!filtered && Boolean.TRUE.equals(config.getFilterDeadHR())) {
                String hrActive = entity.getHrActiveStatus();
                if (hrActive != null && hrActive.contains("年")) {
                    filtered = true;
                }
            }

            entity.setDeliveryStatus(filtered ? "已过滤" : "未投递");

            // 入库（若不存在），优先以 encrypt_id + encrypt_user_id 去重；若 userId 缺失，则以 encrypt_id 去重
            if (encryptId != null) {
                try {
                    boolean exists = false;
                    if (encryptUserId != null) {
        exists = bossService.existsBossJob(encryptId, encryptUserId);
                    } else {
        exists = bossService.existsBossJobByEncryptId(encryptId);
                    }
                    if (!exists) {
        bossService.insertBossJob(entity);
                        log.debug("岗位入库：{} | 公司：{} | HR：{} | 状态：{}", entity.getJobName(), entity.getCompanyName(), entity.getHrName(), entity.getDeliveryStatus());
                    }
                } catch (Exception e) {
                    log.warn("岗位入库失败：{}", e.getMessage());
                }
            }
        } catch (Throwable e) {
            log.debug("解析岗位详情 JSON 失败：{}", e.getMessage());
        }
    }

    public String decodeSalary(String text) {
        Map<Character, Character> fontMap = new HashMap<>();
        fontMap.put('\uE8F0', '0');
        fontMap.put('\uE8F1', '1');
        fontMap.put('\uE8F2', '2');
        fontMap.put('\uE8F3', '3');
        fontMap.put('\uE8F4', '4');
        fontMap.put('\uE8F5', '5');
        fontMap.put('\uE8F6', '6');
        fontMap.put('\uE8F7', '7');
        fontMap.put('\uE8F8', '8');
        fontMap.put('\uE8F9', '9');
        StringBuilder result = new StringBuilder();
        for (char c : text.toCharArray()) {
            result.append(fontMap.getOrDefault(c, c));
        }
        return result.toString();
    }

    // 安全获取单个文本内容
    public String safeText(Locator root, String selector) {
        Locator node = root.locator(selector);
        try {
            if (node.count() > 0 && node.innerText() != null) {
                return node.innerText().trim();
            }
        } catch (Exception e) {
            // ignore
        }
        return "";
    }

    // 安全获取多个文本内容
    public List<String> safeAllText(Locator root, String selector) {
        try {
            return root.locator(selector).allInnerTexts();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    // Boss姓名+活跃状态拆分
    public String[] splitBossName(String raw) {
        String[] bossParts = raw.trim().split("\\s+");
        String bossName = bossParts[0];
        String bossActive = bossParts.length > 1 ? String.join(" ", Arrays.copyOfRange(bossParts, 1, bossParts.length)) : "";
        return new String[]{bossName, bossActive};
    }

    // Boss公司+职位拆分
    public String[] splitBossTitle(String raw) {
        String[] parts = raw.trim().split(" · ");
        String company = parts[0];
        String job = parts.length > 1 ? parts[1] : "";
        return new String[]{company, job};
    }

    // 匹配命中词条（用于日志输出过滤原因）
    private String findMatchedTerm(java.util.Collection<String> patterns, String text) {
        if (patterns == null || text == null) return null;
        try {
            for (String p : patterns) {
                if (p != null && !p.isEmpty() && text.contains(p)) {
                    return p;
                }
            }
        } catch (Exception ignore) {
        }
        return null;
    }

    private String getSearchUrl(String cityCode) {
        String baseUrl = "https://www.zhipin.com/web/geek/job?";
        StringBuilder sb = new StringBuilder(baseUrl);
        String pCity = JobUtils.appendParam("city", cityCode);
        sb.append(pCity);
        String pJobType = JobUtils.appendParam("jobType", config.getJobType());
        sb.append(pJobType);
        String pSalary = JobUtils.appendListParam("salary", config.getSalary());
        sb.append(pSalary);
        String pExp = JobUtils.appendListParam("experience", config.getExperience());
        sb.append(pExp);
        String pDegree = JobUtils.appendListParam("degree", config.getDegree());
        sb.append(pDegree);
        String pScale = JobUtils.appendListParam("scale", config.getScale());
        sb.append(pScale);
        String pIndustry = JobUtils.appendListParam("industry", config.getIndustry());
        sb.append(pIndustry);
        String pStage = JobUtils.appendListParam("stage", config.getStage());
        sb.append(pStage);
        return sb.toString();
    }

    /**
     * 备注：目前Boss无法通过新标签页打开立即沟通按钮，所以只能点击更多详情，然后从更多详情里打开聊天按钮
     */
    @SneakyThrows
    private void resumeSubmission(String keyword, Job job) {
        Page detailPage = null;
        String detailUrl = null;
        try {
            // 若收到停止指令，直接短路返回
            if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                log.info("停止指令已触发，跳过投递 | 公司：{} | 岗位：{}", job.getCompanyName(), job.getJobName());
                return;
            }
            // 调试模式：仅遍历不投递
            if (Boolean.TRUE.equals(config.getDebugger())) {
                log.info("调试模式：仅遍历岗位，不投递 | 公司：{} | 岗位：{}", job.getCompanyName(), job.getJobName());
                return;
            }

            // 1. 查找"查看更多信息"按钮（必须存在且新开页）
            Locator moreInfoBtn = page.locator("a.more-job-btn");
            if (moreInfoBtn.count() == 0) {
                log.warn("未找到\"查看更多信息\"按钮，跳过...");
                return;
            }
            // 强制用js新开tab
            String href = moreInfoBtn.first().getAttribute("href");
            if (href == null || !href.startsWith("/job_detail/")) {
                log.warn("未获取到岗位详情链接，跳过...");
                return;
            }
            detailUrl = "https://www.zhipin.com" + href;
            // 2. 在新窗口打开详情页
            detailPage = page.context().newPage();
            detailPage.navigate(detailUrl);
            PlaywrightUtil.sleep(1);

            // 3. 查找"立即沟通"按钮
            Locator chatBtn = detailPage.locator("a.btn-startchat, a.op-btn-chat");
            boolean foundChatBtn = false;
            for (int i = 0; i < 5; i++) {
                if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                    log.info("停止指令已触发，结束查找聊天按钮 | 公司：{} | 岗位：{}", job.getCompanyName(), job.getJobName());
                    try { detailPage.close(); } catch (Exception ignore) {}
                    return;
                }
                if (chatBtn.count() > 0 && (chatBtn.first().textContent().contains("立即沟通"))) {
                    foundChatBtn = true;
                    break;
                }
                PlaywrightUtil.sleep(1);
            }
            if (!foundChatBtn) {
                log.warn("未找到立即沟通按钮，跳过岗位: {}", job.getJobName());
                // 关闭详情页
                try {
                    detailPage.close();
                } catch (Exception ignore) {
                }
                return;
            }
            chatBtn.first().click();
            PlaywrightUtil.sleep(1);

            // 4. 等待聊天输入框
            Locator inputLocator = detailPage.locator("div#chat-input.chat-input[contenteditable='true'], textarea.input-area");
            boolean inputReady = false;
            for (int i = 0; i < 10; i++) {
                if (shouldStopCallback != null && Boolean.TRUE.equals(shouldStopCallback.get())) {
                    log.info("停止指令已触发，结束等待聊天输入框 | 公司：{} | 岗位：{}", job.getCompanyName(), job.getJobName());
                    try { detailPage.close(); } catch (Exception ignore) {}
                    return;
                }
                if (inputLocator.count() > 0 && inputLocator.first().isVisible()) {
                    inputReady = true;
                    break;
                }
                PlaywrightUtil.sleep(1);
            }
            if (!inputReady) {
                log.warn("聊天输入框未出现，跳过: {}", job.getJobName());
                // 关闭详情页
                try {
                    detailPage.close();
                } catch (Exception ignore) {
                }
                return;
            }

            // 5. AI智能生成打招呼语
            String aiMessage = null;
            if (config.getEnableAI()) {
                String jd = job.getJobInfo();
                if (jd != null && !jd.isEmpty()) {
                    aiMessage = generateAiMessage(keyword, job.getJobName(), jd);
                }
            }
            String message = isValidString(aiMessage) ? aiMessage : config.getSayHi();

            // 6. 输入打招呼语
            Locator input = inputLocator.first();
            input.click();
            Object tagObj = input.evaluate("el => el.tagName.toLowerCase()");
            if (tagObj instanceof String && ((String) tagObj).equals("textarea")) {
                input.fill(message);
            } else {
                // 对 contenteditable 节点写入文本并派发 input 事件
                input.evaluate("(el, msg) => { el.innerText = msg; el.dispatchEvent(new Event('input')); }", message);
            }

            // 7. 点击发送按钮（div.send-message 或 button.btn-send）
            Locator sendText = detailPage.locator("div.send-message, button[type='send'].btn-send, button.btn-send");
            boolean sendSuccess = false;
            if (sendText.count() > 0) {
                sendText.first().click();
                PlaywrightUtil.sleep(1);
                sendSuccess = true;
                try {
                    detailPage.locator("i.icon-close").first().click();
                } catch (Exception e) {
                    log.error("发送文本小窗口关闭失败！");
                }
            } else {
                log.warn("未找到发送按钮，自动跳过！岗位：{}", job.getJobName());
            }

            // 8. 发送图片简历（可选）
            boolean imgResume = false;
            if (Boolean.TRUE.equals(config.getSendImgResume())) {
                imgResume = sendImageResume(detailPage);
            }

            log.info("投递完成 | 公司：{} | 岗位：{} | 薪资：{} | 招呼语：{} | 图片简历：{}", job.getCompanyName(), job.getJobName(), job.getSalary(), message, imgResume ? "已发送" : "未发送");

            // 9. 关闭新打开的详情页
            try {
                detailPage.close();
            } catch (Exception ignore) {
            }
            PlaywrightUtil.sleep(1);

            // 10. 更新数据库投递状态 & 成功投递加入结果
            if (sendSuccess) {
                // 从详情链接提取 encrypt_id，并映射到 encrypt_user_id
                String encryptId = extractEncryptId(detailUrl);
                String encryptUserId = encryptId != null ? encryptIdToUserId.get(encryptId) : null;
                if (encryptId != null && encryptUserId != null) {
                    try {
                        bossService.updateDeliveryStatus(encryptId, encryptUserId, "已投递");
                        log.info("投递成功 | 公司：{} | 岗位：{} | encryptId：{} | encryptUserId：{}", job.getCompanyName(), job.getJobName(), encryptId, encryptUserId);
                    } catch (Exception e) {
                        log.warn("更新投递状态为已投递失败：{}", e.getMessage());
                    }
                } else {
                    log.debug("未能找到 encryptId/encryptUserId 用于更新投递状态，detailUrl: {}", detailUrl);
                }
                resultList.add(job);
            } else {
                // 若发生发送失败，也进行状态更新
                String encryptId = extractEncryptId(detailUrl);
                String encryptUserId = encryptId != null ? encryptIdToUserId.get(encryptId) : null;
                if (encryptId != null && encryptUserId != null) {
                    try {
                        bossService.updateDeliveryStatus(encryptId, encryptUserId, "投递失败");
                        log.warn("投递失败 | 公司：{} | 岗位：{} | encryptId：{} | encryptUserId：{}", job.getCompanyName(), job.getJobName(), encryptId, encryptUserId);
                    } catch (Exception e) {
                        log.warn("更新投递状态为投递失败异常：{}", e.getMessage());
                    }
                }
            }
        } catch (PlaywrightException e) {
            log.warn("Boss 投递单个岗位时浏览器异常，自动跳过该岗位 | 公司：{} | 岗位：{} | 错误：{}", job.getCompanyName(), job.getJobName(), e.getMessage());
        } catch (Exception e) {
            log.warn("Boss 投递单个岗位时发生异常，自动跳过该岗位 | 公司：{} | 岗位：{} | 错误：{}", job.getCompanyName(), job.getJobName(), e.getMessage());
        } finally {
            if (detailPage != null) {
                try {
                    detailPage.close();
                } catch (Exception ignore) {
                }
            }
        }
    }

    

    /**
     * 注册页面响应监听：拦截 /wapi/zpgeek/job/detail.json 请求并解析写库
     */
    private void attachJobDetailResponseListener() {
        if (page == null) return;
        page.onResponse(resp -> {
            try {
                String url = resp.url();
                if (url == null) return;
                // 仅处理 Boss 岗位详情接口（GET）
                if (url.contains("/wapi/zpgeek/job/detail.json") &&
                        "GET".equalsIgnoreCase(resp.request().method())) {
                    String body = null;
                    try {
                        body = resp.text();
                    } catch (Throwable ignore) {
                        // 某些情况下可能拿不到文本，忽略
                    }
                    if (body == null || body.isEmpty()) return;

                    // 保存原始 JSON 到 target/job.txt
                    appendRawJson(body);

                    // 仅记录映射与原始 JSON；入库逻辑已移动到点击卡片时
                    JSONObject root = new JSONObject(body);
                    JSONObject zpData = root.optJSONObject("zpData");
                    if (zpData == null) return;
                    JSONObject jobInfo = zpData.optJSONObject("jobInfo");
                    if (jobInfo == null) return;
                    String encryptId = jobInfo.optString("encryptId", null);
                    String encryptUserId = jobInfo.optString("encryptUserId", null);
                    if (encryptId != null && encryptUserId != null) {
                        encryptIdToUserId.put(encryptId, encryptUserId);
                    }
                }
            } catch (Throwable e) {
                log.debug("监听岗位详情响应处理异常：{}", e.getMessage());
            }
        });
    }

    /**
     * 追加保存原始 JSON 到 target/job.txt
     */
    private void appendRawJson(String body) {
        try {
            java.io.File dir = new java.io.File("target");
            if (!dir.exists()) dir.mkdirs();
            java.io.File file = new java.io.File(dir, "job.txt");
            try (java.io.FileWriter fw = new java.io.FileWriter(file, true)) {
                fw.write(body);
                fw.write(System.lineSeparator());
                fw.write("\n");
            }
        } catch (Exception e) {
            log.debug("写入 target/job.txt 失败：{}", e.getMessage());
        }
    }

    /**
     * 从详情页 URL 中提取 encrypt_id
     */
    private String extractEncryptId(String detailUrl) {
        try {
            if (detailUrl == null) return null;
            String key = "/job_detail/";
            int idx = detailUrl.indexOf(key);
            if (idx < 0) return null;
            int start = idx + key.length();
            int end = detailUrl.indexOf(".html", start);
            if (end < 0) end = detailUrl.length();
            return detailUrl.substring(start, end);
        } catch (Exception e) {
            return null;
        }
    }

    public boolean isValidString(String str) {
        return str != null && !str.isEmpty();
    }

    private boolean sendImageResume(Page page) {
        try {
            // 0) 资源存在性校验，避免后续无效操作
            URL resourceUrlCheck = Boss.class.getResource("/resume.jpg");
            if (resourceUrlCheck == null) {
                log.error("资源文件 resume.jpg 不存在，跳过发送图片简历");
                return false;
            }

            // 进入聊天页
            if (!page.url().contains("/web/geek/chat")) {
                Locator chatBtn = page.locator("a.btn-startchat, a.op-btn-chat");
                if (chatBtn.count() == 0) {
                    log.warn("未找到【继续沟通/立即沟通】按钮，跳过发送图片简历");
                    return false;
                }
                chatBtn.first().click();
                page.waitForURL("**/web/geek/chat**", new Page.WaitForURLOptions().setTimeout(15_000));
            }

            // 1) 解析图片路径（在可能触发文件选择器前就准备好）
            java.nio.file.Path imagePath = resolveResumeImage();

            // 精准定位聊天工具栏内的图片输入，避免匹配到页面其他上传控件
            Locator imgContainer = page.locator("div.btn-sendimg[aria-label='发送图片'], div[aria-label='发送图片'].btn-sendimg");
            Locator imageInput = imgContainer.locator("input[type='file'][accept*='image']").first();
            if (imageInput.count() == 0) {
                // 若未渲染，尝试拦截系统文件选择器；若未出现则普通点击促使 input 出现
                if (imgContainer.count() > 0) {
                    boolean chooserHandled = false;
                    try {
                        com.microsoft.playwright.FileChooser chooser = page.waitForFileChooser(() -> {
                            imgContainer.first().click();
                        });
                        chooser.setFiles(imagePath);
                        chooserHandled = true;
                        log.info("通过 FileChooser 直接提交图片文件，避免系统窗口阻塞");
                    } catch (com.microsoft.playwright.PlaywrightException ignore) {
                        // 未弹出系统文件选择器，继续常规流程
                    }
                    if (!chooserHandled) {
                        PlaywrightUtil.sleep(1);
                        imageInput = imgContainer.locator("input[type='file'][accept*='image']").first();
                    }
                }
            }
            imageInput.waitFor(new Locator.WaitForOptions().setTimeout(10_000));

            // 上传图片
            imageInput.setInputFiles(imagePath);
            PlaywrightUtil.sleep(1);
            return true;
        } catch (Throwable e) {
            log.error("发送图片简历失败：{}", e.getMessage(), e);
            return false;
        }
    }

    private java.nio.file.Path resolveResumeImage() throws Exception {
        URL resourceUrl = Boss.class.getResource("/resume.jpg");
        if (resourceUrl == null) {
            throw new IllegalStateException("资源文件 /resume.jpg 未找到，请将图片放置到 src/main/resources 目录下");
        }
        if ("file".equalsIgnoreCase(resourceUrl.getProtocol())) {
            return java.nio.file.Paths.get(resourceUrl.toURI());
        }
        java.nio.file.Path temp = java.nio.file.Files.createTempFile("resume-", ".jpg");
        try (java.io.InputStream in = Boss.class.getResourceAsStream("/resume.jpg")) {
            if (in == null) {
                throw new IllegalStateException("无法从类路径读取 /resume.jpg 资源");
            }
            java.nio.file.Files.copy(in, temp, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return temp;
    }

    /**
     * 检查岗位薪资是否符合预期
     *
     * @return boolean
     * true 不符合预期
     * false 符合预期
     * 期望的最低薪资如果比岗位最高薪资还小，则不符合（薪资给的太少）
     * 期望的最高薪资如果比岗位最低薪资还小，则不符合(要求太高满足不了)
     */
    private boolean isSalaryNotExpected(String salary) {
        try {
            // 1. 如果没有期望薪资范围，直接返回 false，表示"薪资并非不符合预期"
            List<Integer> expectedSalary = config.getExpectedSalary();
            if (!hasExpectedSalary(expectedSalary)) {
                return false;
            }

            // 2. 清理薪资文本（比如去掉 "·15薪"）
            salary = removeYearBonusText(salary);

            // 3. 如果薪资格式不符合预期（如缺少 "K" / "k"），直接返回 true，表示"薪资不符合预期"
            if (!isSalaryInExpectedFormat(salary)) {
                return true;
            }

            // 4. 进一步清理薪资文本，比如去除 "K"、"k"、"·" 等
            salary = cleanSalaryText(salary);

            // 5. 判断是 "月薪" 还是 "日薪"
            String jobType = detectJobType(salary);
            salary = removeDayUnitIfNeeded(salary); // 如果是按天，则去除 "元/天"

            // 6. 解析薪资范围并检查是否超出预期
            Integer[] jobSalaryRange = parseSalaryRange(salary);
            return isSalaryOutOfRange(jobSalaryRange,
                    getMinimumSalary(expectedSalary),
                    getMaximumSalary(expectedSalary),
                    jobType);

        } catch (Exception e) {
            log.error("岗位薪资获取异常！薪资文本【{}】,异常信息【{}】", salary, e.getMessage(), e);
            // 出错时，您可根据业务需求决定返回 true 或 false
            // 这里假设出错时无法判断，视为不满足预期 => 返回 true
            return true;
        }
    }

    /**
     * 是否存在有效的期望薪资范围
     */
    private boolean hasExpectedSalary(List<Integer> expectedSalary) {
        return expectedSalary != null && !expectedSalary.isEmpty();
    }

    /**
     * 去掉年终奖信息，如 "·15薪"、"·13薪"。
     */
    private String removeYearBonusText(String salary) {
        if (salary.contains("薪")) {
            // 使用正则去除 "·任意数字薪"
            return salary.replaceAll("·\\d+薪", "");
        }
        return salary;
    }

    /**
     * 判断是否是按天计薪，如发现 "元/天" 则认为是日薪
     */
    private String detectJobType(String salary) {
        if (salary.contains("元/天")) {
            return "day";
        }
        return "mouth";
    }

    /**
     * 如果是日薪，则去除 "元/天"
     */
    private String removeDayUnitIfNeeded(String salary) {
        if (salary.contains("元/天")) {
            return salary.replaceAll("元/天", "");
        }
        return salary;
    }

    private Integer getMinimumSalary(List<Integer> expectedSalary) {
        return expectedSalary != null && !expectedSalary.isEmpty() ? expectedSalary.get(0) : null;
    }

    private Integer getMaximumSalary(List<Integer> expectedSalary) {
        return expectedSalary != null && expectedSalary.size() > 1 ? expectedSalary.get(1) : null;
    }

    private boolean isSalaryInExpectedFormat(String salaryText) {
        return salaryText.contains("K") || salaryText.contains("k") || salaryText.contains("元/天");
    }

    private String cleanSalaryText(String salaryText) {
        salaryText = salaryText.replace("K", "").replace("k", "");
        int dotIndex = salaryText.indexOf('·');
        if (dotIndex != -1) {
            salaryText = salaryText.substring(0, dotIndex);
        }
        return salaryText;
    }

    private boolean isSalaryOutOfRange(Integer[] jobSalary, Integer miniSalary, Integer maxSalary,
                                       String jobType) {
        if (jobSalary == null) {
            return true;
        }
        if (miniSalary == null) {
            return false;
        }
        if (Objects.equals("day", jobType)) {
            // 期望薪资转为平均每日的工资
            maxSalary = BigDecimal.valueOf(maxSalary).multiply(BigDecimal.valueOf(1000))
                    .divide(BigDecimal.valueOf(21.75), 0, RoundingMode.HALF_UP).intValue();
            miniSalary = BigDecimal.valueOf(miniSalary).multiply(BigDecimal.valueOf(1000))
                    .divide(BigDecimal.valueOf(21.75), 0, RoundingMode.HALF_UP).intValue();
        }
        // 如果职位薪资下限低于期望的最低薪资，返回不符合
        if (jobSalary[1] < miniSalary) {
            return true;
        }
        // 如果职位薪资上限高于期望的最高薪资，返回不符合
        return maxSalary != null && jobSalary[0] > maxSalary;
    }

    public boolean containsDeadStatus(String activeTimeText, List<String> deadStatus) {
        for (String status : deadStatus) {
            if (activeTimeText.contains(status)) {
                return true;// 一旦找到包含的值，立即返回 true
            }
        }
        return false;// 如果没有找到，返回 false
    }

    private String generateAiMessage(String keyword, String jobName, String jd) {
        AiEntity aiConfig = aiService.getAiConfig();
        String introduce = (aiConfig != null && aiConfig.getIntroduce() != null) ? aiConfig.getIntroduce() : "";
        String prompt = (aiConfig != null) ? aiConfig.getPrompt() : null;

        String requestMessage = (prompt != null)
                ? String.format(prompt, introduce, keyword, jobName, jd, config.getSayHi())
                : buildDefaultPrompt(introduce, keyword, jobName, jd);

        try {
            String result = aiService.sendRequest(requestMessage);
            if (result == null) {
                return config.getSayHi();
            }
            return result.toLowerCase().contains("false") ? config.getSayHi() : result;
        } catch (Exception e) {
            log.warn("AI请求失败，使用原有打招呼语: {}", e.getMessage());
            return config.getSayHi();
        }
    }

    private String buildDefaultPrompt(String introduce, String keyword, String jobName, String jd) {
        return "请基于以下信息生成简洁友好的中文打招呼语，不超过60字：\n" +
                "个人介绍：" + introduce + "\n" +
                "关键词：" + keyword + "\n" +
                "职位名称：" + jobName + "\n" +
                "职位描述：" + jd + "\n" +
                "参考语：" + config.getSayHi();
    }

    private Integer[] parseSalaryRange(String salaryText) {
        try {
            return Arrays.stream(salaryText.split("-")).map(s -> s.replaceAll("[^0-9]", "")) // 去除非数字字符
                    .map(Integer::parseInt) // 转换为Integer
                    .toArray(Integer[]::new); // 转换为Integer数组
        } catch (Exception e) {
            log.error("薪资解析异常！{}", e.getMessage(), e);
        }
        return null;
    }

    private void waitForSliderVerify(Page page) {
        String SLIDER_URL = "https://www.zhipin.com/web/user/safe/verify-slider";
        // 最多等待5分钟（防呆，防止死循环）
        long start = System.currentTimeMillis();
        while (true) {
            String url = page.url();
            if (url != null && url.startsWith(SLIDER_URL)) {
                progressCallback.accept("请手动完成Boss直聘滑块验证，通过后在控制台回车继续...", 0, 0);
                System.out.println("\n【滑块验证】请手动完成Boss直聘滑块验证，通过后在控制台回车继续…");
                try {
                    System.in.read();
                } catch (Exception e) {
                    log.error("等待滑块验证输入异常: {}", e.getMessage());
                }
                PlaywrightUtil.sleep(1);
                // 验证通过后页面url会变，循环再检测一次
                continue;
            }
            if ((System.currentTimeMillis() - start) > 5 * 60 * 1000) {
                throw new RuntimeException("滑块验证超时！");
            }
            break;
        }
    }


    private boolean isLoginRequired() {
        try {
            Locator buttonLocator = page.locator(LOGIN_BTNS);
            if (buttonLocator.count() > 0 && buttonLocator.textContent().contains("登录")) {
                return true;
            }
        } catch (Exception e) {
            try {
                page.locator(PAGE_HEADER).waitFor();
                Locator errorLoginLocator = page.locator(ERROR_PAGE_LOGIN);
                if (errorLoginLocator.count() > 0) {
                    errorLoginLocator.click();
                }
                return true;
            } catch (Exception ex) {
                log.info("没有出现403访问异常");
            }
            log.info("cookie有效，已登录...");
            return false;
        }
        return false;
    }

}
