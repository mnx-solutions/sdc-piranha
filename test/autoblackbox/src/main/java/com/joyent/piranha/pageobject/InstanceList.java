package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.$$;

/**
 * Instance list page object. Holds methods to interact with given pages.
 */
public class InstanceList extends AbstractPageObject {
    private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(PropertyHolder.getChangeStatusTimeout());

    /**
     * Checks the state of a freshly created instance.
     *
     * @param instance - instance name
     */
    public void checkForCreatedInstance(String instance) {
        waitForInstanceList();
        SelenideElement el = Common.getRowByText(
                $$(".item-list-container .item"), instance);
        if (el.$(".machine-list-state").text().equals("Creating")) {
            el.$(".loading-small").shouldBe(hidden);
        }
        el = Common.getRowByText($$(".item-list-container .item"),
                instance);
        el.$(".machine-list-state").shouldHave(text("Provisioning"));
    }

    public void checkInstanceStatus(String status, String instance) {
        $(".item-list-container").waitUntil(visible, baseTimeout);
        SelenideElement el = Common.getRowByText(
                $$(".item-list-container .item"), instance);
        if (el.find(".loading-small").isDisplayed()) {
            el.find(".loading-small").waitUntil(hidden, CHANGE_STATUS_TIMEOUT);
        }
        el = Common.getRowByText($$(".item-list-container .item"),
                instance);
        el.find(".machine-list-state").waitUntil(hasText(status), baseTimeout);
    }

    public void toggleInstanceControl(String instance) {
        $(".item-list-container").waitUntil(visible, baseTimeout);
        SelenideElement e = Common.getRowByText(
                $$(".item-list-container .item"), instance);
        $(e).waitUntil(visible, baseTimeout);
        $(e).find(".status").waitUntil(visible, baseTimeout);
        e.find(".status").click();
        if (e.find(".machine-details-info").isDisplayed()) {
            e.find(".machine-details-info").waitUntil(visible, baseTimeout);
        }
        if (!e.find(".machine-details-info").isDisplayed()) {
            e.find(".machine-details-info").waitUntil(hidden, baseTimeout);
        }
    }

    public void changeInstanceStatus(String operation, String instance) {
        $(".item-list-container").waitUntil(visible, baseTimeout);
        SelenideElement e = Common.getRowByText(
                $$(".item-list-container .row-fluid"), instance);
        e.find(byText(operation)).click();
        Common.clickButtonInModal("Yes");
    }

    public void deleteInstance(String instance) {
        getRowByText("object in pagedItems", instance).$("label.checkbox").click();
        performAction("Delete");
        clickButtonInModal("Yes");
        waitForSmallSpinnerDisappear();
    }

    public String getFirstInstanceName() {
        waitForInstanceList();
        String name;
        $("tbody tr", 0).shouldBe(visible);
        $("tbody tr", 0).$(".status").shouldBe(visible);
        name = $("tbody tr", 0).$("td", 1).$("div a").getText();
        return name;
    }

    private SelenideElement getFirstInstanceElement() {
        waitForInstanceList();
        String name;
        $("tbody tr", 1).shouldBe(visible);
        $("tbody tr", 1).$(".status").shouldBe(visible);
        return $("tbody tr", 0).$("td", 1).$("div a");
    }

    public InstanceDetails clickFirstInstance() {
        final SelenideElement firstInstanceElement = getFirstInstanceElement();
        final String text = firstInstanceElement.getText();
        firstInstanceElement.click();
        return new InstanceDetails(text);
    }

    public void waitForInstanceList() {
        $(byText("Instances")).shouldBe(visible);
        $(".loading-medium-after-h1").waitUntil(disappear, baseTimeout);
    }

    public boolean isRunning(String instance) {
        SelenideElement el = Common.getRowByText(
                $$(".item-list-container .item"), instance);
        return el.$(".machine-list-state").text().equals("Running");
    }

    public InstanceDetails openInstanceDetails(String instanceName) {
        $(byText(instanceName)).click();
        return new InstanceDetails(instanceName);
    }

    public InstanceDetails openFirstInstanceDetails() {
        String instanceName = getFirstInstanceName();
        $(byText(instanceName)).click();
        return new InstanceDetails(instanceName);
    }

    public void selectInstance(String name) {
        getRowByText(GRID_ROW_REPEATER, name).$(".checkbox").click();
    }

    public void openGridTab(String tabName) {
        $(By.xpath("//span[@data-ng-repeat=\"filter in tabFilters\" and contains(.,'" + tabName + "')]")).click();
    }
}
