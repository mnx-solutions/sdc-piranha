package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class SideBarMenu extends AbstractPageObject {

    public Dashboard clickDashboard() {
        clickMenu(DASHBOARD_MENU_TITLE);
        return page(Dashboard.class);
    }

    public Storage clickStorage() {
        clickMenu(STORAGE_MENU_TITLE);
        return page(Storage.class);
    }

    public Instances clickCompute() {
        clickMenu(COMPUTE_MENU_TITLE);
        return page(Instances.class);
    }


    public void clickMenu(final String title) {
        $(byText(title)).click();

    }
}
