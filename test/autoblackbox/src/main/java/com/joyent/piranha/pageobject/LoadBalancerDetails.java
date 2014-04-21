package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Condition.visible;
import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class LoadBalancerDetails extends AbstractPageObject {
    public EditLoadBalancer clickEditButton(){
        final SelenideElement editButton = $("button[data-ng-click=\"edit()\"]");
        editButton.waitUntil(visible, baseTimeout);
        editButton.click();
        return page(EditLoadBalancer.class);
    }
}
