package com.joyent.piranha.pageobject;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class SubuserDetails extends CreateSubUser {

    @Override
    String getTitle() {
        return "User Details";
    }

    public Users clickSave() {
        $("[data-ng-click=\"updateUser()\"]").click();
        waitForLargeSpinnerDisappear();
        return page(Users.class);
    }

    public Users clickDelete() {
        $("[data-ng-click=\"deleteUser()\"]").click();
        waitForLargeSpinnerDisappear();
        return page(Users.class);
    }

    public void clickChangePassword() {
        $("[data-ng-click=\"changeUserPassword()\"]").click();
    }

    public String getCountry() {
        return $("#subCountry optgroup [value=\"" + $("#subCountry").val() + "\"]").text();
    }

    public String getCity() {
        return $("#subCity").val();
    }

    public String getState() {
        return $("#subState").val();
    }

    public String getZip() {
        return $("#subZip").val();
    }
}
