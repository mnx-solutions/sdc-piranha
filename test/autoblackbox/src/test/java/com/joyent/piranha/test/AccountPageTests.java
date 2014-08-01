package com.joyent.piranha.test;

import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobjects.AccountPage;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Ignore;
import org.junit.Test;

import static com.codeborne.selenide.Condition.hidden;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.matchesText;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.by;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static com.codeborne.selenide.Selenide.sleep;

public class AccountPageTests extends TestWrapper {

    private static AccountPage accountPage;
    private static String sshKey = "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAvcdJ2SoS7CE3tOBYy1YWqSbzIUhb9jeoMXibvZ0g3bnixOoEcaGY7XPcBWRnI7qhqhah3ITx0kR58UEQI65yc8u775atb4EaJDtGaDZNW+21J8RABG0RDyJg9A09jqGZTm2/8XLzi8BRK2ha+iBmuScyHW5CA1xyXaDJjyRpLawQARO3Mr8yirz8f1KeJwtviLdNlt1hinQH5rniWgq5M9f9b+4Nee0wx9NEzQHu61UFWMZerlO1kE7BTb1u27LeQuwzt8KfDrUMgw25JgEH+EhRdVhMUa5TKeEv6op5YSTu6+XdwcxISFVcbKqEQSD3B6xtS3F8kGgU55yts8G7Nw== aupeniek";
    private static String keyName = "selenide-added-key";

    private static String fName = "anton";
    private static String lName = "upeniek";
    private static String pemail = "anton.upeniek@joyent.com";
    private static String pphone = "4155496510";
    private static String pphoneCountry = "United States (+1)";
    private static String pcompany = "test co";
    private static String username = PropertyHolder.getTestUserLogin();

    private static String bName = "anton upeniek";
    private static String bCardType = "MasterCard";
    private static String bCardNo = "2142";
    private static String bCardDate = "12/2014";

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
        Common.login();
        // addSshKey();
    }

    @Before
    public void openAccountPage() {
        Common.clickNavigationLink("My Account");
        accountPage = page(AccountPage.class);
    }

    @Test
    public void openAccountSummaryTab() {
        accountPage.openSummaryTab();
        Common.checkHeadingText("Account Summary");
    }

    @Test
    public void openEditAccountTab() {
        accountPage.openEditAccountTab();
        Common.checkHeadingText("Edit Account");
    }

    @Test
    public void openBillingTab() {
        accountPage.openBillingTab();
        Common.checkHeadingText("Update Billing Information");
    }

    @Test
    public void openSshKysTab() {
        accountPage.openSshKeysTab();
        Common.checkHeadingText("SSH Public Keys");
    }

    @Test
    public void openAccountPageAndValidateProfileSummary() {
        accountPage.validateSummaryPage();
        accountPage.validateProfileSummary(fName + " " + lName, username,
                pemail, "\\+1" + pphone, pcompany);
    }

    @Test
    public void openAccountPageAndValidateBillingInfo() {
        accountPage.validateBillingInfo(bName, bCardType, bCardNo, bCardDate);
    }

    @Test
    @Ignore
    public void openAccountPageAndVerifySshKey() {
        accountPage.validateSshKey(keyName, sshKey);
    }

    @Test
    public void updateAccountInfo() {
        accountPage.openEditAccountTab();
        Common.checkHeadingText("Edit Account");
        $(by("name", "accountForm")).shouldBe(visible);
        $(".page-header").should(matchesText(username));
        sleep(1000);
        accountPage.setAccountEmail("new@email.com");
        accountPage.setAccountFirstName("User");
        accountPage.setAccountLastName("Name");
        accountPage.setAccountCompany("Company");
        accountPage.setAccountPhone("Estonia (+372)", "5155496510");
        accountPage.saveAccountChanges();
        Common.errorNotPresent();
        $(".alert-success").shouldHave(text("Account updated"));
        accountPage.openSummaryTab();
        accountPage.validateProfileSummary("User Name", username,
                "new@email.com", "\\+3725155496510", "Company");

    }

    @Test
    public void editBillingInformation() {
        accountPage.openBillingTab();
        accountPage.setCreditCardNumber("123");
        accountPage.setCreditCardValidToDate("01", "2020");
        accountPage.setCreditCardCcV("123");
        accountPage.setCreditCardFirstName("Einar");
        accountPage.setCreditCardLastName("Kootikum");
        accountPage.deselectBillingContactInfoCheckbox();
        accountPage.setBillingAddressCity("Linn");
        accountPage.setBillingAddressCountry("Latvia");
        accountPage.setBillingAddressLine1("Adrl 1");
        accountPage.setBillingAddressLine2("Adrl 2");
        accountPage.setBillingAddressState("Maakond");
        accountPage.setBillingAddressZip("123");
    }

    @Test
    @Ignore
    public void storagePageHasAddedSshKey() {
        Common.clickNavigationLink("Storage");
        $("#keySel").shouldBe(visible);
        $("#keySel").selectOption(keyName);
    }

    private static void addSshKey() {
        Common.clickNavigationLink("My Account");
        accountPage = page(AccountPage.class);
        accountPage.openSshKeysTab();
        accountPage.importSshPublicKey(keyName, sshKey);
        $(".new-key-button.loading-medium").waitUntil(hidden, BASE_TIMEOUT);
        $(".alert-success").shouldHave(text("New key successfully added"));
        accountPage.validateSshKeyOnSshKeysPage(keyName, sshKey);
    }

    private static void deleteAddedPublicKey() {
        accountPage.openSshKeysTab();
        Common.checkHeadingText("SSH Public Keys");
        SelenideElement holder = $(".ssh div.col-md-9 div.row");
        holder.waitUntil(matchText("(.*)" + keyName + "(.*)"), 120000);
        accountPage.deleteSshPublicKey(keyName);
        Common.errorNotPresent();
    }

    private static void restoreOldAccountInfo() {
        Common.clickNavigationLink("My Account");
        accountPage = page(AccountPage.class);
        accountPage.openEditAccountTab();
        Common.checkHeadingText("Edit Account");
        $(by("name", "accountForm")).shouldBe(visible);
        $(".page-header").should(matchesText(username));
        sleep(1000);
        accountPage.setAccountCompany(pcompany);
        accountPage.setAccountEmail(pemail);
        accountPage.setAccountFirstName(fName);
        accountPage.setAccountLastName(lName);
        accountPage.setAccountPhone(pphoneCountry, pphone);
        accountPage.saveAccountChanges();
        $(".alert-success").shouldHave(text("Account updated"));
    }

    @AfterClass
    public static void cleanupAndLogout() {
        try {
            restoreOldAccountInfo();
            // deleteAddedPublicKey();
        } finally {
            open("/landing/forgetToken");
        }
    }
}
