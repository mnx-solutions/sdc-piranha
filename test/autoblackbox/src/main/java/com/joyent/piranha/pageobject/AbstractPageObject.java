package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public abstract class AbstractPageObject {
    private static final String GLOBAL_TIMEOUT_KEY = "globaltimeout";
    private static final String GLOBAL_TIMEOUT_DEF = "15000";
    private static final Integer CHANGE_STATUS_TIMEOUT = Integer.parseInt(System.getProperty("statustimeout", "240000"));

    static final String DASHBOARD_MENU_TITLE = "Dashboard";
    static final String COMPUTE_MENU_TITLE = "Compute";
    static final String STORAGE_MENU_TITLE = "Storage";
    static final String FIREWALL_MENU_TITLE = "Firewall";
    static final String IMAGES_MENU_TITLE = "Images";

    static int baseTimeout;

    public AbstractPageObject() {
        this(Integer.parseInt(System.getProperty(GLOBAL_TIMEOUT_KEY, GLOBAL_TIMEOUT_DEF)));
    }

    public AbstractPageObject(int baseTimeout) {
        AbstractPageObject.baseTimeout = baseTimeout;
    }

    public void errorNotPresent() {
        if ($(".alert-error").isDisplayed()) {
            System.out.println($(".alert-error").text());
        }
    }

    public void checkBreadcrumb(String active, String right) {
        $("ul.breadcrumb li", 0).$("a").should(matchText(active));
        $("ul.breadcrumb li", 1).shouldHave(matchText("(.*)" + right));
    }

    public void checkTitle(String headingText) {
        getPageTitle().shouldHave(matchText("(.*)" + headingText + "(.*)"));
    }

    public void checkTitle() {
        getPageTitle().shouldHave(matchText("(.*)" + getTitle() + "(.*)"));
    }

    public SelenideElement getPageTitle() {
        return $(".page-title");
    }

    String getTitle() {
        throw new NullPointerException();
    }

    public void waitingLoading() {
        $(".loading-large").waitUntil(disappear, baseTimeout);
        $(".loading-medium-after-h1").waitUntil(disappear, baseTimeout);
    }

    public void waitForSmallSpinnerDisappear() {
        $(".pull-right.loading-small").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public void waitForMediumSpinnerDisappear() {
        $(".loading-medium[style=\"\"]").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public void waitForLargeSpinnerDisappear() {
        $(".loading-large[style=\"\"]").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public SelenideElement getErrorLabel() {
        return $(".alert.alert-error");
    }

    public SelenideElement getInfoLabel() {
        return $(".alert.alert-info");
    }

    public void clickButtonInModal(String buttonName) {
        $(".modal").shouldBe(visible);
        $(".modal-header").exists();
        $(".modal-footer").find(byText(buttonName)).click();
    }

    public void performAction(String action) {
        clickActionsButton();
        SelenideElement actionsList = $("#option-list-actions");
        actionsList.waitUntil(visible, baseTimeout);
        actionsList.$(byText(action)).click();
    }

    public void clickActionsButton() {
        $("#button-actions").click();
    }

    public void clickColumnsButton() {
        $("#button-columns").click();
    }

    public boolean isErrorDisplayed(String errorText) {
        return $(byText(errorText)).isDisplayed();
    }

    public void setValue(SelenideElement fieldSelector, String value) {
        fieldSelector.clear();
        fieldSelector.sendKeys(value);
    }

    public SelenideElement getRowByText(String dataNgRepeat, String textContains) {
        return $(By.xpath("//tr[@data-ng-repeat='"+dataNgRepeat+"']/td[contains(., \'"+textContains+"\')]/.."));
    }

    public void addGridColumn(String columnName) {
        clickColumnsButton();
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('#checkbox-list-columns label:contains(" + columnName + ") input').click();");
        $(By.xpath("//th[@data-ng-repeat=\"prop in props | orderBy:'sequence'\" and contains(.,'" + columnName + "')]")).waitUntil(visible, baseTimeout);
    }
}
