package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class Compute extends AbstractPageObject {
    public SelenideElement getCountInstancesRunning() {
        return $("#count-instances-running");
    }

    public SelenideElement getInstancesLabel() {
        return $(byText("Instances"));
    }

}
