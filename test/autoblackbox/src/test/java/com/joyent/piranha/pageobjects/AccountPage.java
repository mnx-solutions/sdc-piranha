package com.joyent.piranha.pageobjects;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import org.openqa.selenium.NoSuchElementException;

import static com.codeborne.selenide.Condition.empty;
import static com.codeborne.selenide.Condition.hasText;
import static com.codeborne.selenide.Condition.matchText;
import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;

/**
 * "My Account" and its child pages page object. Holds methods to interact with
 * given pages.
 */
public class AccountPage {
    public void openSummaryTab() {
        $(".nav-tabs").$(byText("Summary")).click();
    }

    public void openEditAccountTab() {
        $(".nav-tabs").$(byText("Edit Account")).click();
    }

    public void openBillingTab() {
        $(".nav-tabs").$(byText("Billing")).click();
    }

    public void openSshKeysTab() {
        $(".nav-tabs").$(byText("SSH Keys")).click();
    }

    public void validateSummaryPage() {
        Common.checkHeadingText("Account Summary");
        Common.checkSubHeadingText("Profile summary");
        Common.checkSubHeadingText("Billing info");
        Common.checkSubHeadingText("SSH Public Keys");
    }

    /**
     * Validates the info in "Profile Summary" section.
     * @param name     - name of the user
     * @param username - username
     * @param email    - email of the user
     * @param phone    - phone of the user
     * @param company  - company of the user
     */
    public void validateProfileSummary(String name, String username,
                                       String email, String phone, String company) {
        SelenideElement holder = $(".account").$("fieldset", 0);
        holder.$("h6").shouldHave(text("General info"));
        holder.should(matchText("Name " + name));
        holder.should(matchText("Username " + username));
        holder.should(matchText("Email " + email));
        holder.should(matchText("Phone " + phone));
        holder.should(matchText("Company " + company));
    }

    /**
     * Validates the info in "Billing info" section.
     * @param name     - name of the user
     * @param cardType - billing card type
     * @param cardNo   - card number
     * @param exp      - expiration date of the card
     */
    public void validateBillingInfo(String name, String cardType,
                                    String cardNo, String exp) {
        SelenideElement holder = $(".account").$("fieldset", 1);
        holder.$("h6").shouldHave(text("Credit Card info"));
        holder.should(matchText(name));
        holder.should(matchText("Card type: " + cardType));
        holder.should(matchText("Card No: (.*)" + cardNo));
        holder.should(matchText("Exp. Date: " + exp));
    }

    /**
     * Basic validation of the SSH keys section.
     */
    public void validateSshSummary() {
        SelenideElement holder = $(".account").$("fieldset", 2);
        holder.$(".item-list-container-header").shouldHave(
                text("Key Name / UUID"));
    }

    /**
     * Method for adding a public key.
     * @param keyName - the displayed name of the key
     * @param key     - key as a string
     */
    public void importSshPublicKey(String keyName, String key) {
        $(byText("Import Public Key")).click();
        $(".modal-header h1").shouldHave(text("Import SSH Public Key"));
        $(".modal-body input").setValue(keyName);
        $(".modal-body textarea").setValue(key);
        $(".modal-footer").$(byText("Add")).click();
    }

    /**
     * Method for deleting a key under "SSH keys" tab.
     * @param keyName
     */
    public void deleteSshPublicKey(String keyName) {
        SelenideElement holder = $(".ssh div.col-md-9 div.row");
        SelenideElement el = getSshKeyRow(keyName, holder);
        el.$("span.title").click();
        el.$(byText("Delete")).click();
        Common.clickButtonInModal("Yes");
    }

    /**
     * Method for validating key and key name info under My Account SSK Public
     * Keys section.
     * @param keyName
     * @param sshKey
     */
    public void validateSshKey(String keyName, String sshKey) {
        SelenideElement holder = $(".account").$("fieldset", 2);
        SelenideElement el = getSshKeyRow(keyName, holder);
        System.out.println(el);
        el.click();
        el.$(".row", 1).$(".value").should(hasText(sshKey));
        el.click();
    }

    /**
     * Method for validating key and key name info under My Account SSK Keys
     * sub-page.
     * @param keyName
     * @param sshKey
     */
    public void validateSshKeyOnSshKeysPage(String keyName, String sshKey) {
        SelenideElement holder = $(".ssh div.col-md-9 div.row");
        SelenideElement el = getSshKeyRow(keyName, holder);
        el.$("span.title").click();
        el.$(".row", 1).$(".value").should(hasText(sshKey));
        el.$("span.title").click();
    }

    /**
     * Method for getting the desired row of the ssh keys table.
     * @param keyName
     * @param holder  holder of the item-list-container table
     * @return SelenideElement of the row in given container
     */
    public SelenideElement getSshKeyRow(String keyName, SelenideElement holder) {
        holder.waitUntil(matchText("(.*)" + keyName + "(.*)"), 120000);
        ElementsCollection c = holder.$(".item-list-container").$$(
                "div.item.row");
        for (SelenideElement el : c) {
            if (el.text().matches("(.*)" + keyName + "(.*)")) {
                return el;
            }
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    // Getters and Setters of Edit Account subpage.

    public void setAccountEmail(String email) {
        $("#email").shouldNotBe(empty);
        $("#email").setValue(email);
    }

    public void setAccountFirstName(String name) {
        $("#firstName").shouldNotBe(empty);
        $("#firstName").setValue(name);
    }

    public void setAccountLastName(String name) {
        $("#lastName").shouldNotBe(empty);
        $("#lastName").setValue(name);
    }

    public void setAccountCompany(String company) {
        $("#companyName").shouldNotBe(empty);
        $("#companyName").setValue(company);
    }

    public void setAccountPhone(String country, String number) {
        $("select").selectOption(country);
        $(byAttribute("data-ng-model", "plainNumber")).setValue(number);
    }

    public String getAccountEmail() {
        return $("#email").val();
    }

    public String getAccountFirstName() {
        return $("#firstName").val();
    }

    public String getAccountLastName() {
        return $("#lastName").val();
    }

    public String getAccountCompany() {
        return $("#companyName").val();
    }

    public String getAccountPhoneCountry() {
        $(byAttribute("data-ng-model", "country")).$(
                byAttribute("selected", "selected")).shouldBe(visible);
        return $(byAttribute("data-ng-model", "country")).getSelectedText();
    }

    public String getAccountPhone() {
        return $(byAttribute("data-ng-model", "plainNumber")).val();
    }

    public void saveAccountChanges() {
        $(byText("Save changes")).click();
    }

    // Getters and Setters of Billing subpage.

    public void selectBillingContactInfoCheckbox() {
        if (!$("#useExisting").isSelected()) {
            $("#useExisting").click();
        }
    }

    public void deselectBillingContactInfoCheckbox() {
        if ($("#useExisting").isSelected()) {
            $("#useExisting").click();
        }
    }

    public String getBillingAddressLine1() {
        return $("#addressLine1").val();
    }

    public String getBillingAddressLine2() {
        return $("#addressLine2").val();
    }

    public String getBillingAddressCountry() {
        return $("#country").getSelectedText();
    }

    public String getBillingAddressCity() {
        return $("#city").val();
    }

    public String getBillingAddressState() {
        return $("#state").val();
    }

    public String getBillingAddressZip() {
        return $("#zipCode").val();
    }

    public void setBillingAddressLine1(String adr) {
        $("#addressLine1").clear();
        $("#addressLine1").setValue(adr);
    }

    public void setBillingAddressLine2(String adr) {
        $("#addressLine2").clear();
        $("#addressLine2").setValue(adr);
    }

    public void setBillingAddressCountry(String country) {
        $("#country").selectOption(country);
    }

    public void setBillingAddressCity(String city) {
        $("#city").clear();
        $("#city").setValue(city);
    }

    public void setBillingAddressState(String state) {
        $("#state").clear();
        $("#state").setValue(state);
    }

    public void setBillingAddressZip(String zip) {
        $("#zipCode").clear();
        $("#zipCode").setValue(zip);
    }

    public void setCreditCardNumber(String number) {
        $("#creditCardNumber").clear();
        $("#creditCardNumber").setValue(number);
    }

    public void setCreditCardValidToDate(String month, String year) {
        $("#expirationMonth").selectOption(month);
        $("#expirationYear").selectOption(year);
    }

    public void setCreditCardCcV(String ccv) {
        $("#securityCode").clear();
        $("#securityCode").setValue(ccv);
    }

    public void setCreditCardFirstName(String name) {
        $("#firstName").clear();
        $("#firstName").setValue(name);
    }

    public void setCreditCardLastName(String name) {
        $("#lastName").clear();
        $("#lastName").setValue(name);
    }
}
