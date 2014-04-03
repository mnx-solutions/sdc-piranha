package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;

import static com.codeborne.selenide.Selenide.$;

public class Zenbox extends AbstractPageObject {

    public SelenideElement getQuestionInput() {
        return $("#subject");
    }

    public SelenideElement getNameInput() {
        return $("#name");
    }

    public void closeDialog() {
        WebDriverRunner.getWebDriver().switchTo().defaultContent();
        $("#zenbox_close").click();
    }
}
