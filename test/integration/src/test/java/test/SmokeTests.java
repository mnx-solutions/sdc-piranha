package test;

import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Selectors.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.WebDriverRunner.getWebDriver;

import org.junit.*;
import org.junit.Assert.*;
import org.junit.rules.TestName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import util.Common;
import util.SauceAuthentication;

public class SmokeTests implements SauceOnDemandSessionIdProvider {
	private InstanceList instanceList;
	private CreateInstanceCarousel createInstanceCarousel;
	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));

	// SauceUutils
	 SauceAuthentication sa = new SauceAuthentication();
	 private static String sessionId;
	 private static WebDriver driver = getWebDriver();
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

	// SauceUtils
	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		open("/");
		Common.login();
	}

	@AfterClass
	public static void logout() {
		open("/landing/forgetToken");
	}

	@After
	public void goToDashboard() {
		Common.errorNotPresent();
		Common.clickNavigationLink("Dashboard");
	}

	@Test
	public void dashboardIsVisible() {
		Common.clickNavigationLink("Dashboard");
		Common.checkHeadingText("Welcome anton");
		Common.checkBreadcrumb("Dashboard", "Create Instance");
		$(byAttribute("data-ng-show", "runningcount")).shouldBe(visible);
		$("h4").should(matchText("Instance status"));
		$("h4").$("a").should(matchText("All Instances"));
		$(withText("Joyent Blog")).shouldBe(visible);
		$(withText("Support FAQ")).shouldBe(visible);
		$(withText("System Status")).shouldBe(visible);
	}

	@Test
	public void instanceListIsVible() {
		Common.clickNavigationLink("Compute");
		Common.checkBreadcrumb("Compute", "Create Instance");
		$(byText("Instances")).shouldBe(visible);
		$(".loading-large").waitUntil(disappear, BASE_TIMEOUT);
		$(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
		instanceList = page(InstanceList.class);
		String in = instanceList.getFirtstInstanceName();
		instanceList.toggleInstanceControl(in);
	}

	@Test
	public void instanceAnalyticsIsVisible() {
		Common.clickNavigationLink("Compute");
		Common.checkBreadcrumb("Compute", "Create Instance");
		$(byText("Instances")).shouldBe(visible);
		Common.errorNotPresent();
		$(".loading-large").waitUntil(disappear, BASE_TIMEOUT);
		$(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
		instanceList = page(InstanceList.class);
		String in = instanceList.getFirtstInstanceName();
		$(byText(in)).click();
		Common.checkHeadingText(in);
		$(byText("Start Analytics")).click();
		Common.checkBreadcrumb(
				"Dashboard / Instance details / Cloud analytics",
				"Create Instance");
		$(byText("Choose your components")).shouldBe(visible);
//		assert $("select.ng-pristine").getSelectedValue().equals(in);
		Common.errorNotPresent();
	}

	@Test
	public void storagePageIsVible() {
		Common.clickNavigationLink("Storage");
		Common.errorNotPresent();
		$(byText("Introduction")).shouldBe(visible);
	}

	@Test
	public void accountSummaryIsVisible() {
		Common.clickNavigationLink("My Account");
		Common.checkHeadingText("Account Summary");
		Common.checkBreadcrumb("Account", "Create Instance");
		Common.checkSubHeadingText("Profile summary");
		Common.checkSubHeadingText("Billing info");
		Common.checkSubHeadingText("SSH Public Keys");
		$("span.item-list-container-header").shouldHave(
				text("Key Name / Fingerprint"));
		Common.openSubHeadingEditLink("Profile summary");
		Common.checkHeadingText("Edit Account");
		Common.checkBreadcrumb("Account/ Edit account", "Create Instance");
		Common.clickNavigationLink("My Account");
		Common.openSubHeadingEditLink("Billing info");
		Common.checkBreadcrumb("Account/ Billing information",
				"Create Instance");
		Common.checkHeadingText("Update Billing Information");
		Common.clickNavigationLink("My Account");
		Common.openSubHeadingEditLink("SSH Public Keys");
		Common.checkBreadcrumb("Account/ SSH keys", "Create Instance");
		Common.checkHeadingText("SSH Public Keys");
		Common.clickNavigationLink("My Account");
		Common.checkHeadingText("Account Summary");
	}

	@Test
	public void createInstanceCarouselIsVisible() {
		String instanceName = "selenide-created-instance";
		String os = "base";
		String version = "13.2.0";
		String dataCenter = "us-west-1";
		String packageType = "Standard";
		String packageSize = "Standard 0.25";
		$(byText("Create Instance")).click();
		Common.checkHeadingText("Create Instance");
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.waitUntilPageIsActive(0);
		createInstanceCarousel.selectZoneFilter(dataCenter);
		$(byAttribute("data-ng-model", "searchText")).click();
		createInstanceCarousel.selectOsFilter("smartos");
		createInstanceCarousel.selectOsVersion(os, version);
		createInstanceCarousel.selectOsImage(os);
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel.selectInstanceType(packageType);
		createInstanceCarousel.selectPackage(packageSize);
		createInstanceCarousel.checkSelectedImageText("A 32-bit SmartOS");
		createInstanceCarousel.checkPackageInfo(dataCenter, "256 MB", "16 GB",
				"0.125 and bursting");
		createInstanceCarousel.checkPaymentInfo("0.008", "5.84");
		createInstanceCarousel.setInstanceNameValue(instanceName);
		$(byText("Create instance")).click();
		createInstanceCarousel.cancelInstanceCreation();
	}

	@Test
	public void logoutAndLogIn() {
		open("/landing/forgetToken");
		$(byText("Already a customer?")).shouldBe(visible);
		$(byText("New to Joyent?")).shouldBe(visible);
		$(byAttribute("type", "button")).click();
		$(byAttribute("name", "username")).setValue(
				System.getProperty("loginusr"));
		$(byAttribute("name", "password")).setValue("lol");
		$("#login-submit").click();
		$(".alert-error").shouldHave(text("Invalid username or password"));
		$("#login-submit").click();
		$(".alert-error")
				.shouldHave(text("username and password are required"));
		$(byAttribute("name", "username")).setValue(
				System.getProperty("loginusr"));
		$(byAttribute("name", "password")).setValue(
				System.getProperty("loginpw"));
		$("#login-submit").click();
		Common.checkBreadcrumb("Dashboard", "Create Instance");
	}

}
