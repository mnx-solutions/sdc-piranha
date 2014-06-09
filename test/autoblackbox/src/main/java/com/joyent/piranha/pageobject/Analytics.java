package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class Analytics extends AbstractPageObject {
    public SelenideElement getSelectInstanceLabel() {
        return $(byText("Select Instance:"));
    }

    public SelenideElement getStartAnalyticsButton() {
        return $("#button-start");
    }

    public SelenideElement getGraphTitleElement(final String repeater, final String title) {
        return $(By.xpath("//div[@data-ng-repeat='" + repeater + "']//p[contains(., \'" + title + "\')]/.."));
    }
}
