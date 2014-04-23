package com.joyent.piranha;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Scanner;
import java.util.Set;

import static com.codeborne.selenide.Condition.hasText;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.open;
import static org.junit.Assert.assertTrue;

/**
 * Common interaction methods for UI elements
 */
public class Common {

    private static final int BASE_TIMEOUT = Integer.parseInt(System.getProperty("globaltimeout", "15000"));
    private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System.getProperty("statustimeout", "240000"));

    public static void login() {
        $(byAttribute("type", "button")).click();
        $(byAttribute("name", "username")).setValue(System.getProperty("loginusr"));
        $(byAttribute("name", "password")).setValue(System.getProperty("loginpw"));
        $("#login-submit").click();
        $("#count-instances-running").waitWhile(hasText("0"), BASE_TIMEOUT);
    }

    public static void checkSubHeadingText(String headingText) {
        ElementsCollection headingTextContainer = $$("legend");
        assertTrue(Common.getRowByText(headingTextContainer, headingText).exists());
    }

    public static void openSubHeadingEditLink(String headingText) {
        ElementsCollection headingTextContainer = $$("legend");
        Common.getRowByText(headingTextContainer, headingText).$(byText("Edit")).click();
    }

    @Deprecated
    public static SelenideElement getRowByText(ElementsCollection col, String filter) {
        for (SelenideElement element : col) {
            if (element.findAll(byText(filter)).size() > 0) {
                return element;
            }
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    public static void checkHeadingText(String headingText) {
        $(".page-title").shouldHave(matchText("(.*)" + headingText + "(.*)"));
    }

    public static void clickNavigationLink(String text) {
        $(byText(text)).click();
    }

    public static void openFirewallPage() {
        $(byText("Compute")).click();
        $(byText("Firewall")).click();
    }

    public static void openMyAccount() {
        $(byText(System.getProperty("loginusr"))).click();
        $("#link-account").click();
    }

    public static void openChangePasswordDialog() {
        $(byText(System.getProperty("loginusr"))).click();
        $("[data-ng-click=\"changePassword()\"]").click();
    }

    public static int getCollectionIndexByText(ElementsCollection col, String filter) {
        int i = 0;
        $(byText(filter)).shouldBe(visible);
        for (SelenideElement element : col) {
            if (element.findAll(byText(filter)).size() > 0) {
                return i;
            }
            i++;
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    public static void clickButtonInModal(String buttonName) {
        $(".modal").shouldBe(visible);
        $(".modal-header").exists();
        $(".modal-footer").find(byText(buttonName)).click();
    }

    public static void checkBreadcrumb(String active, String right) {
        $("ul.breadcrumb li", 0).$("a").should(matchText(active));
        $("ul.breadcrumb li", 1).shouldHave(matchText("(.*)" + right));
    }

    public static void errorNotPresent() {
        if ($(".alert-error").isDisplayed()) {
            System.out.println($(".alert-error").text());
        }
    }

    public static String[] instanceProperties() {
        if (System.getProperty("datacenter").equals("us-west-b") || System.getProperty("datacenter").equals("local-x")) {
            return new String[]{
                    "base",
                    "13.3.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 vCPUs",
                    "$0.008",
                    "$5.84"};
        } else if (System.getProperty("datacenter").equals("us-west-1")) {
            return new String[]{
                    "base",
                    "13.2.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 and bursting",
                    "0.008",
                    "5.84"};
        }
        return new String[]{};
    }

    public static String getTestInstanceName() {
        final String instanceName;
        switch (System.getProperty("datacenter")) {
            case "us-west-b":
            case "local-x":
                instanceName = "dnd-forImageAutoTests";
                break;
            default:
                instanceName = " ";
        }
        return instanceName;
    }

    public static String getSLBTestInstance() {
        return "dnd-forSLBTests";
    }

    public static String getValueFromLog(String key) throws FileNotFoundException, JSONException {
        File log = new File(System.getProperty("serverLogPath"));
        String result = null;
            Scanner scanner = new Scanner(log);
            while (scanner.hasNext()) {
                String line = scanner.nextLine();
                if (line.contains(key)) {
                    JSONObject newJson = new JSONObject(line);
                    result = newJson.get(key).toString();
                }
            }
        return result;
    }

    public static void addGridColumn(String columnName) {
        Common.clickColumnsButton();
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('#checkbox-list-columns label:contains(" + columnName + ") input').click();");
        $(By.xpath("//th[@data-ng-repeat=\"prop in props | orderBy:'sequence'\" and contains(.,'" + columnName + "')]")).waitUntil(visible, BASE_TIMEOUT);
    }

    public static void clickColumnsButton() {
        $("#button-columns").click();
    }

    public static void clickActionsButton() {
        $("#button-actions").click();
    }

    public static void forceLogout() {
        open("/landing/forgetToken");
    }

    public static void performAction(String action) {
        clickActionsButton();
        $("#option-list-actions").waitUntil(visible, BASE_TIMEOUT);
        $("#option-list-actions").$(byText(action)).click();
    }

    public static void switchWindow(SelenideElement elementToBeVisible) {
        Set<String> windows = WebDriverRunner.getWebDriver().getWindowHandles();
        for (String window1 : windows) {
            WebDriverRunner.getWebDriver().switchTo().window(window1);
            if (elementToBeVisible.isDisplayed()) {
                return;
            }
        }
    }

    public static void waitForSmallLaoderDisappear() {
        $(".pull-right.loading-small").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
    }

    public static void waitForMediumLaoderDisappear() {
        $(".loading-medium.spiner-height").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
    }
}
