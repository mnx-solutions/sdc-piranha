package com.joyent.piranha.pageobject.instancedetails;

import com.codeborne.selenide.Condition;
import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.AbstractPageObject;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class TagSection extends AbstractPageObject {

    public void addTag(String key, String value) {
        addItem(key, value, "tags");
    }

    public void addItem(String key, String value, String section) {
        SelenideElement sectionElement = $("[data-collection-name=\"'" + section + "'\"]");
        int lines = sectionElement.$$("[data-ng-repeat=\"item in internalCollection\"]").size();
        SelenideElement row = sectionElement.$("[data-ng-repeat=\"item in internalCollection\"]", lines - 1);
        String el = section.equals("tags") ? "input" : "textarea";
        row.$("[placeholder=\"Key\"]").setValue(key);
        row.$(el + "[placeholder=\"Value\"]").setValue(value);
        row.$("[data-ng-click=\"addItem(item)\"]").click();
        waitForMediumSpinnerDisappear();
    }

    public void waitForMediumSpinnerDisappear() {
        int longTimeout = Integer.parseInt(PropertyHolder.getChangeStatusTimeout());
        SelenideElement spinner = $(By.xpath("//div[@class='pull-right loading-medium item']"));
        if (spinner.exists()) {
            spinner.waitWhile(Condition.exist, longTimeout);
        } else {
            $(By.xpath("//div[@class='loading-medium item-button' and @style=\"visibility: visible;\"]")).waitWhile(Condition.exist, longTimeout);
        }
    }

    public SelenideElement getTagRepeaterByKey(String key) {
        return $(By.xpath("//div[contains(.,\"" + key + "\") and contains(@class, \"key\")]/../../.."));
    }

    public void removeTag(String key) {
        $(byText(key)).$(By.xpath("..")).$("[data-ng-click=\"removeItem(item)\"]").click();
        waitForMediumSpinnerDisappear();
    }
}
