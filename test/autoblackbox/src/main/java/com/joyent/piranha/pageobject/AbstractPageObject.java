package com.joyent.piranha.pageobject;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;

public abstract class AbstractPageObject {
    private static final String GLOBAL_TIMEOUT_KEY = "selenium.globaltimeout";
    private static final String GLOBAL_TIMEOUT_DEF = "15000";
    private static final Integer CHANGE_STATUS_TIMEOUT = Integer.parseInt(PropertyHolder.getChangeStatusTimeout());
    public static final String GRID_ROW_REPEATER = "object in pagedItems";


    static final String DASHBOARD_MENU_TITLE = "Dashboard";
    static final String COMPUTE_MENU_TITLE = "Compute";
    static final String STORAGE_MENU_TITLE = "Storage";
    static final String FIREWALL_MENU_TITLE = "Firewall";
    static final String IMAGES_MENU_TITLE = "Images";
    static final String SLB_MENU_TITLE = "Load Balancers";
    static final String USAGE_MENU_TITLE = "Usage";

    public static int baseTimeout;

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
        SelenideElement element = $(By.xpath("//span[contains(@class,'loading-small') and not(contains(@class,'ng-hide'))]"));
        element.waitUntil(exist, baseTimeout);
        element.waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public void waitForMediumSpinnerDisappear() {
        $(".loading-medium[style=\"\"]").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
        $(".loading-medium[style=\"visibility: visible;\"]").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
        $(By.xpath("//*[contains(@class,'loading-medium-transparent') and not(contains(@class,'ng-hide'))]")).waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public void waitForLargeSpinnerDisappear() {
        $(".loading-large[style=\"\"]").waitWhile(exist, CHANGE_STATUS_TIMEOUT);
        $(By.xpath("//div[contains(@class,'loading-large') and not(contains(@class,'ng-hide'))]")).waitWhile(exist, CHANGE_STATUS_TIMEOUT);
    }

    public ElementsCollection getErrorLabel() {
        return $$(".error");
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
        return $(By.xpath("//tr[@data-ng-repeat='" + dataNgRepeat + "']/td[contains(., \'" + textContains + "\')]/.."));
    }

    public void addGridColumn(String columnName) {
        if (!$(By.xpath("//thead//th[contains(.,\"" + columnName + "\") and not(contains(@class,\"ng-hide\"))]")).exists()) {
            clickColumnsButton();
            $("#checkbox-list-columns").waitUntil(visible, baseTimeout);
            SelenideElement column = $(By.xpath("//div[@data-ng-repeat=\"prop in props | orderBy:'sequence'\" and contains (.,\"" + columnName + "\")]//div"));
            column.waitUntil(visible, baseTimeout);
            column.click();
            clickColumnsButton();
        }
    }
}
