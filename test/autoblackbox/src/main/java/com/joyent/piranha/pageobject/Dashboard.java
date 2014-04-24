package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Dashboard extends AbstractPageObject {

    public static final String TITLE = "Dashboard";

    @Override
    String getTitle(){
        return TITLE;
    }

    public SelenideElement getCountInstancesRunning() {
        return $("#count-instances-running");
    }

    public SelenideElement getFreeTierWidget() {
        return $(By.xpath("//div[@class=\"widget grey links2 host\" and contains(.,\"Free Dev Tier\") ]"));
    }

    public void checkHeadingDashboard() {
        checkTitle(DASHBOARD_MENU_TITLE);
    }

    public CreateInstanceQuickStart clickCreateComputeInstance() {
        $("#button-create-instance").click();
        return page(CreateInstanceQuickStart.class);
    }

    public LoadBalancers clickViewMoreLBDetails() {
        $(byText("VIEW LOAD BALANCER DETAILS")).click();
        return page(LoadBalancers.class);
    }
}
