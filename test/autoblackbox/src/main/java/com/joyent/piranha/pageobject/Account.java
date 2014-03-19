package com.joyent.piranha.pageobject;

import com.codeborne.selenide.SelenideElement;
import org.openqa.selenium.By;

import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.page;

public class Account extends AbstractPageObject {
    public static final String TITLE = "Account Summary";

    public enum Legend {
        YouProfile("Your Profile"), BillingInformation("Billing Information"), SSH("SSH");
        private final String label;

        Legend(String label) {
            this.label = label;
        }
    }

    @Override
    protected String getTitle() {
        return TITLE;
    }

    public EditProfile clickEditProfile() {
        getEdit(Legend.YouProfile).click();
        return page(EditProfile.class);
    }

    public EditBillingInformation clickEditBilling() {
        getEdit(Legend.BillingInformation).click();
        return page(EditBillingInformation.class);
    }

    public SelenideElement getLabel(final Legend legend) {
        return $(By.xpath(String.format("//legend/span[.='%s']", legend.label)));
    }

    public SelenideElement getEdit(final Legend legend) {
        return $(By.xpath(String.format("//legend/span[.='%s']/../a[@class='edit-btn']", legend.label)));
    }

    public AccountSSH getSSHContainer() {
        return page(AccountSSH.class);
    }
}
