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
        return $(".tile.free-tier-bg");
    }

    public void checkHeadingDashboard() {
        checkTitle(DASHBOARD_MENU_TITLE);
    }

    public CreateInstanceManual clickCreateComputeInstance() {
        $("#button-create-instance").click();
        return page(CreateInstanceManual.class);
    }

    public LoadBalancers clickViewMoreLBDetails() {
        $(byText("VIEW LOAD BALANCER DETAILS")).click();
        return page(LoadBalancers.class);
    }

    public CreateInstanceQuickStart clickCreateFreeTier() {
        getFreeTierWidget().$(byText("+ Create Free Instance")).click();
        return new CreateInstanceQuickStart(true);
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

    public SelenideElement getCompleteBillingButton() {
        return $(byText("Complete Account Information"));
    }

    public EditBillingInformation clickCompleteBillingButton(){
        getCompleteBillingButton().click();
        return  page(EditBillingInformation.class);
    }
}
