package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreatePolicy extends AbstractPageObject {
    public void setName(String name) {
        SelenideElement element = $("[name=\"policyName\"]");
        element.waitUntil(visible, baseTimeout);
        setValue(element, name);
    }

    public Policies clickCreatePolicy() {
        $("[data-ng-click=\"createPolicy(true)\"]").click();
        waitForLargeSpinnerDisappear();
        return page(Policies.class);
    }

    public void addRule(String role) {
        setValue($(".new-rule input"), role);
        $(".new-rule button").click();
    }

    public void deletePolicy(String role) {
        $(By.xpath("//div[@class='controls rules' and contains(.,'" + role + "')]/div[@data-ng-click=\"removeRule(rule)\"]")).click();
    }
}
