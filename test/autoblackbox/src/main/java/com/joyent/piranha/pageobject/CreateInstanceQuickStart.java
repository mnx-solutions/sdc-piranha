package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreateInstanceQuickStart extends AbstractPageObject {
    public static final String TITLE = "Quick Start: Create Instance";

    @Override
    String getTitle() {
        return TITLE;
    }

    public CreateInstance clickViewMoreImages() {
        $("#link-more-images").click();
        return page(CreateInstance.class);
    }

}
