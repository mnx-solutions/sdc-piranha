package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;

import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class AccountSSH extends AbstractPageObject {
    public SelenideElement getKeyNameLabel() {
        return $(".accordion-ssh-package-title");
    }

    public ELBApiForm clickELBApi() {
        $(".key-name.ng-binding").click();
        return page(ELBApiForm.class);
    }

    public static class ELBApiForm extends AbstractPageObject {
        public SelenideElement getFingerprintLabel() {
            return $(byText("Fingerprint"));
        }
    }
}
