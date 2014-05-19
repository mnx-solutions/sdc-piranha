package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.interactions.HasInputDevices;
import org.openqa.selenium.interactions.Mouse;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Dashboard extends AbstractPageObject {

    public static final String TITLE = "Dashboard";

    @Override
    String getTitle() {
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

    public CreateInstance clickCreateComputeInstance() {
        $("#button-create-instance").click();
        return page(CreateInstance.class);
    }

    public LoadBalancers clickViewMoreLBDetails() {
        $(byText("VIEW LOAD BALANCER DETAILS")).click();
        return page(LoadBalancers.class);
    }

    public CreateInstanceQuickStart clickCreateFreeTier() {
        $(By.xpath("//button[contains(.,'Create Free Dev Tier')]")).click();
        return page(CreateInstanceQuickStart.class);
    }

    public boolean checkForFreeTierInDatacenter(String datacenter) {
        boolean result = false;
        final String brightDash = "//div[@data-ng-repeat and contains(.,\"" + datacenter + "\")]//*[contains(@class, \"lightbulb-enable\")]";
        if ($(By.xpath(brightDash)).exists()) {
            result = true;
        }
        return result;
    }

    public String getFreeTierTooltipText(String datacenter) {
        SelenideElement q = $(By.xpath("//div[@data-ng-repeat and contains(.,\"" + datacenter + "\")]"));
        Mouse mouse = ((HasInputDevices) WebDriverRunner.getWebDriver()).getMouse();
        mouse.mouseMove(q.getCoordinates());
        $(".tooltip-inner").waitUntil(exist, baseTimeout);
        return $(".tooltip-inner").getText();
    }
}
