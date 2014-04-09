package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Dashboard extends AbstractPageObject {
    public SelenideElement getCountInstancesRunning() {
        return $("#count-instances-running");
    }

    public void checkHeadingDashboard() {
        checkTitle(DASHBOARD_MENU_TITLE);
    }

    public CreateInstanceQuickStart clickCreateComputeInstance() {
        $("#button-create-instance").click();
        return page(CreateInstanceQuickStart.class);
    }

}
