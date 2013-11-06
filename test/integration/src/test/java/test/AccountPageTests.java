package test;

import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.*;
import static com.codeborne.selenide.WebDriverRunner.getWebDriver;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.By.ByName;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.codeborne.selenide.SelenideElement;
import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

import pageobjects.AccountPage;
import util.Common;
import util.SauceAuthentication;

public class AccountPageTests implements SauceOnDemandSessionIdProvider {
	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	private static AccountPage accountPage;
	private static String sshKey = "ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAvcdJ2SoS7CE3tOBYy1YWqSbzIUhb9jeoMXibvZ0g3bnixOoEcaGY7XPcBWRnI7qhqhah3ITx0kR58UEQI65yc8u775atb4EaJDtGaDZNW+21J8RABG0RDyJg9A09jqGZTm2/8XLzi8BRK2ha+iBmuScyHW5CA1xyXaDJjyRpLawQARO3Mr8yirz8f1KeJwtviLdNlt1hinQH5rniWgq5M9f9b+4Nee0wx9NEzQHu61UFWMZerlO1kE7BTb1u27LeQuwzt8KfDrUMgw25JgEH+EhRdVhMUa5TKeEv6op5YSTu6+XdwcxISFVcbKqEQSD3B6xtS3F8kGgU55yts8G7Nw== aupeniek";
	private static String keyName = "selenide-added-key";

	private static String fName = "anton";
	private static String lName = "upeniek";
	private static String pemail = "anton.upeniek@joyent.com";
	private static String pphone = "4155496510";
	private static String pphoneCountry = "United States (+1)";
	private static String pcompany = "test co";

	// Sauce test watcher start

	 SauceAuthentication sa = new SauceAuthentication();
	 private static WebDriver driver = getWebDriver();
	 private static String sessionId;
	 public @Rule
	 TestName testName = new TestName();
	 public @Rule
	 SauceOnDemandTestWatcher resultReportingTestWatcher = new
	 SauceOnDemandTestWatcher(
	 this, sa.getAuthentication());
	
	 @Override
	 public String getSessionId() {
	 return sessionId;
	 }
	
	 @Before
	 public void setSessionId() {
	 sessionId = ((RemoteWebDriver) driver).getSessionId().toString();
	 }

	// Sauce test watcher end
	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		open("/");
		Common.login();
		addSshKey();
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
		accountPage.validateProfileSummary("anton upeniek", "aupeniek",
				"anton.upeniek@joyent.com", "4155496510", "test co");
	}

	@Test 
	public void openAccountPageAndValidateBillingInfo() {
		accountPage.validateBillingInfo("anton upeniek", "MasterCard", "2142",
				"12/2014");
	}

	@Test
	public void openAccountPageAndVerifySshKey() {
		accountPage.validateSshKey(keyName, sshKey);
	}

	@Test 
	public void updateAccountInfo() {
		accountPage.openEditAccountTab();
		Common.checkHeadingText("Edit Account");
		$(by("name", "accountForm")).shouldBe(visible);
		$(".page-header").should(matchesText("aupeniek"));
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
		accountPage.validateProfileSummary("User Name", "aupeniek",
				"new@email.com", "5155496510", "Company");

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
	public void storagePageHasAddedSshKey() {
		Common.clickNavigationLink("Storage");
		$("#keySel").shouldBe(visible);
		$("#keySel").selectOption(keyName);
	}

	private static void getCurrentAccountInfo() {
		Common.clickNavigationLink("My Account");
		accountPage = page(AccountPage.class);
		accountPage.openEditAccountTab();
		fName = accountPage.getAccountFirstName();
		lName = accountPage.getAccountLastName();
		pemail = accountPage.getAccountEmail();
		pphone = accountPage.getAccountPhone();
		pphoneCountry = accountPage.getAccountPhoneCountry();
		pcompany = accountPage.getAccountCompany();
	}

	private static void addSshKey() {
		Common.clickNavigationLink("My Account");
		accountPage = page(AccountPage.class);
		accountPage.openSshKeysTab();
		accountPage.importSshPublicKey(keyName, sshKey);
		$(".alert-success").shouldHave(text("New key successfully added"));
		accountPage.validateSshKeyOnSshKeysPage(keyName, sshKey);
		sleep(1000);
	}

	private static void deleteAddedPublicKey() {
		accountPage.openSshKeysTab();
		Common.checkHeadingText("SSH Public Keys");
		SelenideElement holder = $(".ssh div.span9 div.row-fluid");
		holder.waitUntil(matchText("(.*)" + keyName + "(.*)"), 120000);
		accountPage.deleteSshPublicKey(keyName, sshKey);
		Common.errorNotPresent();
	}

	private static void restoreOldAccountInfo() {
		Common.clickNavigationLink("My Account");
		accountPage = page(AccountPage.class);
		accountPage.openEditAccountTab();
		Common.checkHeadingText("Edit Account");
		$(by("name", "accountForm")).shouldBe(visible);
		$(".page-header").should(matchesText("aupeniek"));
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
			deleteAddedPublicKey();
		} finally {
			open("/landing/forgetToken");
		}
	}
}
