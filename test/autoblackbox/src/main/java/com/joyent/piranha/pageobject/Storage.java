package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

public class Storage extends AbstractPageObject {
    public SelenideElement getIntroductionLabel() {
        return $(byText("Introduction"));
    }
}
