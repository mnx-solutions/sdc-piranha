package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Dashboard extends AbstractPageObject {
    public SelenideElement getCountInstancesRunning() {
        return $("#count-instances-running");
    }

    public void checkHeadingDashboard() {
        checkHeadingText(DASHBOARD_MENU_TITLE);
    }

    public CreateInstance clickCreateComputeInstance() {
        $("#button-create-instance").click();
        return page(CreateInstance.class);
    }

}
