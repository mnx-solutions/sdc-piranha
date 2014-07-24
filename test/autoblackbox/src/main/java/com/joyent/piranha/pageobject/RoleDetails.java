package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class RoleDetails extends CreateRole {
    @Override
    String getTitle() {
        return "Role Details";
    }

    public Roles clickSave() {
        $("[data-ng-click=\"updateRole()\"]").click();
        waitForLargeSpinnerDisappear();
        return page(Roles.class);
    }

    public Roles clickDelete() {
        $("[data-ng-click=\"deleteRole()\"]").click();
        return page(Roles.class);
    }
}
