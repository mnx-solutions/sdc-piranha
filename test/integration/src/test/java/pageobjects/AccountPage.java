package pageobjects;

import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.By.ByName;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;

import util.Common;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.*;

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

	public void validateBillingInfo(String name, String cardType,
			String cardNo, String exp) {
		SelenideElement holder = $(".account").$("fieldset", 1);
		holder.$("h6").shouldHave(text("Credit Card info"));
		holder.should(matchText(name));
		holder.should(matchText("Card type: " + cardType));
		holder.should(matchText("Card No: (.*)" + cardNo));
		holder.should(matchText("Exp. Date: " + exp));
	}

	public void validateSshSummary() {
		SelenideElement holder = $(".account").$("fieldset", 2);
		holder.$(".item-list-container-header").shouldHave(
				text("Key Name / UUID"));
	}

	public void importSshPublicKey(String keyName, String key) {
		$(byText("Import Public Key")).click();
		$(".modal-header h1").shouldHave(text("Import SSH Public Key"));
		$(".modal-body input").setValue(keyName);
		$(".modal-body textarea").setValue(key);
		$(".modal-footer").$(byText("Add")).click();
	}

	public void deleteSshPublicKey(String keyName, String sshKey) {
		SelenideElement holder = $(".ssh div.span9 div.row-fluid");
		SelenideElement el = getSshKeyRow(keyName, holder);
		el.$("span.title").click();
		el.$(byText("Delete")).click();
		Common.confirmModal();
	}

	public void validateSshKey(String keyName, String sshKey) {
		SelenideElement holder = $(".account").$("fieldset", 2);
		SelenideElement el = getSshKeyRow(keyName, holder);
		el.$(".item-list-container-header").click();
		el.$(".row-fluid", 1).$(".value").should(hasText(sshKey));
		el.$(".item-list-container-header").click();
	}

	public void validateSshKeyOnSshKeysPage(String keyName, String sshKey) {
		SelenideElement holder = $(".ssh div.span9 div.row-fluid");
		SelenideElement el = getSshKeyRow(keyName, holder);
		el.$("span.title").click();
		el.$(".row-fluid", 1).$(".value").should(hasText(sshKey));
		el.$("span.title").click();
	}

	public SelenideElement getSshKeyRow(String keyName, SelenideElement holder) {
		holder.waitUntil(matchText("(.*)" + keyName + "(.*)"), 120000);
		ElementsCollection c = holder.$(".item-list-container").$$(
				"div.item.row-fluid");
		for (SelenideElement el : c) {
			if (el.text().matches("(.*)" + keyName + "(.*)")) {
				return el;
			}
		}
		throw new NoSuchElementException("Such element doesn't exist");
	}

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
		$("#countryCode").selectOption(country);
		$("#phone").shouldNotBe(empty);
		$("#phone").setValue(number);
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
		$("#countryCode").$(byAttribute("selected", "selected")).shouldBe(
				visible);
		return $("#countryCode").getSelectedText();
	}

	public String getAccountPhone() {
		return $("#phone").val();
	}

	public void saveAccountChanges() {
		$(byText("Save changes")).click();
	}

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
		$("#addressLine1").shouldBe(empty);
		$("#addressLine1").setValue(adr);
	}

	public void setBillingAddressLine2(String adr) {
		$("#addressLine2").clear();
		$("#addressLine2").shouldBe(empty);
		$("#addressLine2").setValue(adr);
	}

	public void setBillingAddressCountry(String country) {
		$("#country").selectOption(country);
	}

	public void setBillingAddressCity(String city) {
		$("#city").clear();
		$("#city").shouldBe(empty);
		$("#city").setValue(city);
	}

	public void setBillingAddressState(String state) {
		$("#state").clear();
		$("#state").shouldBe(empty);
		$("#state").setValue(state);
	}

	public void setBillingAddressZip(String zip) {
		$("#zipCode").clear();
		$("#zipCode").shouldBe(empty);
		$("#zipCode").setValue(zip);
	}

	public void setCreditCardNumber(String number) {
		$("#creditCardNumber").clear();
		$("#creditCardNumber").shouldBe(empty);
		$("#creditCardNumber").setValue(number);
	}

	public void setCreditCardValidToDate(String month, String year) {
		$("#expirationMonth").selectOption(month);
		$("#expirationYear").selectOption(year);
	}

	public void setCreditCardCcV(String ccv) {
		$("#securityCode").clear();
		$("#securityCode").shouldBe(empty);
		$("#securityCode").setValue(ccv);
	}

	public void setCreditCardFirstName(String name) {
		$("#firstName").clear();
		$("#firstName").shouldBe(empty);
		$("#firstName").setValue(name);
	}

	public void setCreditCardLastName(String name) {
		$("#lastName").clear();
		$("#lastName").shouldBe(empty);
		$("#lastName").setValue(name);
	}
}
