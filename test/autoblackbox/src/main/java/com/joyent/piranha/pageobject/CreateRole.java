package com.joyent.piranha.pageobject;


import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreateRole extends AbstractPageObject {
    @Override
    String getTitle() {
        return "Create Role";
    }

    public void setName(String roleName) {
        SelenideElement element = $("[name=\"roleName\"]");
        element.waitUntil(visible, baseTimeout);
        setValue(element, roleName);
    }

    public Roles clickCreateRole() {
        $("[data-ng-click=\"createRole()\"]").click();
        return page(Roles.class);
    }

    public void addUser(String user) {
        $(By.xpath("//li[contains(.,'" + user + "') and not(contains(@style,'display: none;'))]")).click();
    }

    public void addPolicy(String policyName) {
        $("#policies ul li i").click();
        $(byText(policyName)).click();
    }
}
