package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class CreateSubUser extends UserInfo {

    @Override
    String getTitle() {
        return "Create User";
    }

    public Users clickCreateUser() {
        $("[data-ng-click=\"createUser()\"]").click();
        return page(Users.class);
    }

    public void assignRole(String roleName) {
        $(".ms-selectable").$(byText(roleName)).click();
        $(".ms-selection").$(byText(roleName)).waitUntil(visible, baseTimeout);
    }

}
