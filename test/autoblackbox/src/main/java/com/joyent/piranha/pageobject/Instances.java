package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

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


}
