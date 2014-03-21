package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class TagSection extends AbstractPageObject {

    public void addTag(String key, String value) {
        SelenideElement tagSection = $("[data-collection-name=\"'tags'\"]");
        int lines = tagSection.$$("[data-ng-repeat=\"item in internalCollection\"]").size();
        SelenideElement row = $("[data-ng-repeat=\"item in internalCollection\"]", lines - 1);
        row.$("[placeholder=\"Key\"]").setValue(key);
        row.$("[placeholder=\"Value\"]").setValue(value);
        row.$("[data-ng-click=\"addItem(item)\"]").click();
        waitForSmallSpinnerDisappear();
    }

    public SelenideElement getTagRepeaterByKey(String key) {
        SelenideElement tagKey = $(byText(key));
        return tagKey.$(By.xpath("/../../.."));
    }

    public void removeTag(String key) {
        $(byText(key)).$(By.xpath("..")).$("[data-ng-click=\"removeItem(item)\"]").click();
        waitForSmallSpinnerDisappear();
    }
}
