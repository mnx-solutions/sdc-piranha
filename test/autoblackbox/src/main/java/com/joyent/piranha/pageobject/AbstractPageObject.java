package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Condition.disappear;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;

public abstract class AbstractPageObject {
    private static final String GLOBAL_TIMEOUT_KEY = "globaltimeout";
    private static final String GLOBAL_TIMEOUT_DEF = "15000";
    private static final Integer CHANGE_STATUS_TIMEOUT = Integer.parseInt(System.getProperty("statustimeout", "240000"));

    static final String DASHBOARD_MENU_TITLE = "Dashboard";
    static final String COMPUTE_MENU_TITLE = "Compute";
    static final String STORAGE_MENU_TITLE = "Storage";

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

    public void checkHeadingText(String headingText) {
        getPageTitle().shouldHave(matchText("(.*)" + headingText + "(.*)"));
    }

    public SelenideElement getPageTitle() {
        return $(".page-title");
    }

    public void checkTitle() {
        getPageTitle().shouldHave(matchText("(.*)" + getTitle() + "(.*)"));
    }

    String getTitle() {
        throw new NullPointerException();
    }


    public void waitingLoading() {
        $(".loading-large").waitUntil(disappear, baseTimeout);
        $(".loading-medium-after-h1").waitUntil(disappear, baseTimeout);
    }

    public void waitForSmallSpinnerDisappear() {
        $(".pull-right.loading-small").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
    }

    public void waitForMediumSpinnerDisappear() {
        $(".loading-medium[style=\"\"]").waitWhile(visible, CHANGE_STATUS_TIMEOUT);
    }

    public SelenideElement getErrorLabel(){
        return $(".alert.alert-error");
    }

    public SelenideElement getInfoLabel(){
        return $(".alert.alert-info");
    }
}
