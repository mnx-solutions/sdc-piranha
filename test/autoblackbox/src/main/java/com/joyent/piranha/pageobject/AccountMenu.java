package com.joyent.piranha.pageobject;

import org.openqa.selenium.By;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class AccountMenu extends AbstractPageObject {

    public Account clickAccount() {
        $("#link-account").click();
        waitForLargeSpinnerDisappear();
        waitForMediumSpinnerDisappear();
        return page(Account.class);
    }

    public ChangePassword clickChangePassword() {
        $("[data-ng-click=\"changePassword()\"]").click();
        return page(ChangePassword.class);
    }

    public void clickLogout() {
        $(By.xpath("//a[contains(.,'Log Out')]")).click();
    }
}
