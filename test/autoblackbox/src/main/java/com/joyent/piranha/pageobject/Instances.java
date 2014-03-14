package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Instances extends AbstractPageObject {
    public static final String TITLE = "Instances";

    @Override
    String getTitle() {
        return TITLE;
    }

    public InstanceList getList() {
        return page(InstanceList.class);
    }

    public void clickActionsButton() {
        $("#button-actions").click();
    }

    public void clickColumnsButton() {
        $("#button-columns").click();
    }

    public SelenideElement getListActions() {
        return $("#option-list-actions");
    }

    public SelenideElement getCheckboxListColumns() {
        return $("#checkbox-list-columns");
    }

    public void addGridColumn(String columnName) {
        clickColumnsButton();
        JavascriptExecutor executor = (JavascriptExecutor) WebDriverRunner.getWebDriver();
        executor.executeScript("$('#checkbox-list-columns label:contains(" + columnName + ") input').click();");
        $(By.xpath("//th[@data-ng-repeat=\"prop in props | orderBy:'sequence'\" and contains(.,'" + columnName + "')]")).waitUntil(visible, baseTimeout);
    }

    public boolean isTagDisplayed(String key, String value) {
        return $(By.xpath("//span[contains(.,'\"" + key + "\":\"" + value + "\')]")).isDisplayed();
    }


}
