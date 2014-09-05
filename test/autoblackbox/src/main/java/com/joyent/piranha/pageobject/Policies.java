package com.joyent.piranha.pageobject;


import com.codeborne.selenide.Condition;
import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Policies extends AbstractPageObject {
    public CreatePolicy clickCreatePolicy() {
        SelenideElement element = $(byText("Create Policy"));
        element.waitUntil(Condition.visible, baseTimeout);
        element.click();
        return page(CreatePolicy.class);
    }

    public String createTestPolicy() {
        CreatePolicy createPolicy = clickCreatePolicy();
        String policyName = "testPolicy" + System.currentTimeMillis();
        createPolicy.setName(policyName);
        createPolicy.addRule("can test");
        createPolicy.clickCreatePolicy();
        createPolicy.waitForLargeSpinnerDisappear();
        return policyName;
    }

    public PolicyDetails openPolicyDetails(String policyName) {
        $(byText(policyName)).click();
        waitForLargeSpinnerDisappear();
        return page(PolicyDetails.class);
    }
}
