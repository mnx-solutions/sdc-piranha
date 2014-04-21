package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class EditLoadBalancer extends AbstractPageObject {

    public void setName(String name) {
        final SelenideElement nameField = $("input[name=\"name\"]");
        nameField.waitUntil(visible, baseTimeout);
        setValue(nameField, name);
    }

    public void setProtocol(String protocol) {
        $(By.xpath("//span[contains(.,'Protocol')]/../div/button")).click();
        $(byText(protocol)).click();
        $(byText(protocol)).shouldBe(visible);
    }

    public LoadBalancers clickCreateButton() {
        $("[data-ng-click=\"save()\"]").click();
        waitForLargeSpinnerDisappear();
        return page(LoadBalancers.class);
    }

    public LoadBalancers clickUpdateButton(){
        return clickCreateButton();
    }

    public void selectInstance(String instanceName) {
        getRowByText("machine in machines", instanceName).$("[type=\"checkbox\"]").click();
    }

    public LoadBalancers clickDeleteButton(){
        final SelenideElement deleteButton = $("[data-ng-click=\"delete()\"]");
        deleteButton.waitUntil(visible, baseTimeout);
        deleteButton.click();
        return page(LoadBalancers.class);
    }
}
