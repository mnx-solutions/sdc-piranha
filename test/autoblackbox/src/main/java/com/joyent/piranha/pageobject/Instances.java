package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Instances extends AbstractPageObject {
    public static final String TITLE = "Instances";

    @Override
    String getTitle() {
        return TITLE;
    }

    public InstanceList getInstanceList() {
        return page(InstanceList.class);
    }

    public SelenideElement getListActions() {
        return $("#option-list-actions");
    }

    public SelenideElement getCheckboxListColumns() {
        return $("#checkbox-list-columns");
    }

    public boolean isTagDisplayed(String key, String value) {
        return $(By.xpath("//span[contains(.,'\"" + key + "\":\"" + value + "\')]")).isDisplayed();
    }

}
