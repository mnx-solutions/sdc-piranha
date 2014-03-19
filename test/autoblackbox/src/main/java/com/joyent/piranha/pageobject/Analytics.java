package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class Analytics extends AbstractPageObject {
    public SelenideElement getSelectInstanceLabel() {
        return $(byText("Select Instance:"));
    }

    public SelenideElement getStartAnalyticsButton() {
        return $("#button-start");
    }
}
