package com.joyent.piranha.test;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import java.text.DateFormatSymbols;
import java.util.Calendar;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class UsagePageTest extends TestWrapper {
    private static Usage usage;

    @BeforeClass
    public static void signin() {
        baseUrl = BASE_URL;
        Login loginPage = open("/", Login.class);
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
        usage = page(SideBarMenu.class).clickUsage();
    }

    @Before
    public void goUsage() {
        usage.waitForMediumSpinnerDisappear();
    }

    @Test
    public void testSpendChart() {
        String chartName = "Spend";
        Chart chart = usage.getChart(chartName);
        String title = "Current Spend";
        String leftBlockText = "month to date";
        checkChart(chart, title, "", leftBlockText);
        ChartPage spend = usage.clickOnChart(chartName);
        spend.getPageTitle().shouldHave(text("Spend Overview"));
        chart = spend.getChart(chartName);
        checkChart(chart, title, "", leftBlockText);
        spend.clickBackToUsage().checkTitle();
    }

    @Test
    public void testComputeChart() {
        String chartName = "Compute";
        Chart chart = usage.getChart(chartName);
        String title = "Compute Utilized";
        String totalUsage = "this month";
        String leftBlockText = "month to date";
        checkChart(chart, title, totalUsage, leftBlockText);
        ChartPage spend = usage.clickOnChart(chartName);
        spend.getPageTitle().shouldHave(text("Compute Usage Overview"));
        chart = spend.getChart(chartName);
        checkChart(chart, title, totalUsage, leftBlockText);
        spend.clickBackToUsage().checkTitle();
    }

    @Test
    public void testBandwidthChart() {
        String chartName = "Bandwidth";
        Chart chart = usage.getChart(chartName);
        String title = "Bandwidth Utilized";
        String totalUsage = "this month";
        String leftBlockText = "month to date";
        checkChart(chart, title, totalUsage, leftBlockText);
        ChartPage spend = usage.clickOnChart(chartName);
        spend.getPageTitle().shouldHave(text("Bandwidth Usage Overview"));
        chart = spend.getChart(chartName);
        checkChart(chart, title, totalUsage, leftBlockText);
        spend.clickBackToUsage().checkTitle();
    }

    @Test
    public void testMantaChart() {
        String chartName = "Manta";
        Chart chart = usage.getChart(chartName);
        String title = "Manta Utilized";
        String leftBlockText = "month to date";
        checkChart(chart, title, "", leftBlockText);
        ChartPage spend = usage.clickOnChart(chartName);
        spend.getPageTitle().shouldHave(text("Manta Usage Overview"));
        chart = spend.getChart(chartName);
        checkChart(chart, title, "", leftBlockText);
        spend.clickBackToUsage().checkTitle();
    }

    @Test
    public void testPreviousMonth() {
        usage.clickViewPreviousButton();
        usage.waitForMediumSpinnerDisappear();
        usage.getViewCurrentButton().shouldBe(visible);
        Calendar cal = Calendar.getInstance();
        DateFormatSymbols dfs = new DateFormatSymbols();
        String[] months = dfs.getMonths();
        String month = months[(cal.get(Calendar.MONTH) - 1)];

        Chart chart = usage.getChart("Spend");
        String title = month + " Monthly Spend";
        checkChart(chart, title, "", "");
        chart = usage.getChart("Compute");
        title = month + " Compute Utilized";
        checkChart(chart, title, "", "");
        chart = usage.getChart("Bandwidth");
        title = month + " Bandwidth Utilized";
        checkChart(chart, title, "", "");
        chart = usage.getChart("Manta");
        title = month + " Manta Utilized";
        checkChart(chart, title, "", "");
    }

    private void checkChart(Chart currentSpend, String title, String totalUsage, String leftBlockText) {
        if (totalUsage.equals("")) {
            assertFalse(currentSpend.getTotalUsageDiv().isDisplayed());
        } else {
            assertTrue(currentSpend.getTotalUsage().equals(totalUsage));
        }
        assertTrue(currentSpend.getLeftBlockText().equals(leftBlockText));
        assertTrue(currentSpend.getChartTitle().equals(title));
        assertTrue(currentSpend.isChartEmpty());
    }

}
