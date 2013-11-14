package test;

import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.Selectors.*;
import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.WebDriverRunner.getWebDriver;
import static org.junit.Assert.*;

import java.util.ArrayList;
import java.util.List;

import org.junit.*;
import org.junit.rules.TestName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import pageobjects.InstancePage;
import util.Common;
import util.SauceAuthentication;

public class NetworkTests /* implements SauceOnDemandSessionIdProvider */{
	SauceAuthentication sa = new SauceAuthentication();
	private static String sessionId;
	private static WebDriver driver = getWebDriver();
	private CreateInstanceCarousel createInstanceCarousel;
	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));

	private static InstanceList instanceList;
	private InstancePage instancePage;

	private static List<String> instances;

	// public @Rule
	// TestName testName = new TestName();
	// public @Rule
	// SauceOnDemandTestWatcher resultReportingTestWatcher = new
	// SauceOnDemandTestWatcher(
	// this, sa.getAuthentication());
	//
	// @Override
	// public String getSessionId() {
	// return sessionId;
	// }

	// @Before
	// public void setSessionId() {
	// sessionId = ((RemoteWebDriver) driver).getSessionId().toString();
	// }

	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		instances = new ArrayList<String>();
		open("/");
		Common.login();
	}

	@AfterClass
	public static void logout() {
		deleteInstances(instances);
		open("/landing/forgetToken");
	}

	private static void deleteInstances(List<String> instances) {
		$(byText("Compute")).click();
		instanceList = page(InstanceList.class);
		for (String instance : instances) {
			instanceList.toggleInstanceControl(instance);
			instanceList.changeInstanceStatus("Stop", instance);
		}
		instanceList.checkInstanceStatus("Stopped", instances.get(0));
		for (String instance : instances) {
			instanceList.deleteInstance(instance);
		}
	}

	@After
	public void goToDashboard() {
		Common.clickNavigationLink("Dashboard");
	}

	@Test
	public void createInPrivateUsWest() {
		assertTrue(createMachine("us-west-1", "10.12", false, true));
	}

	@Test
	public void createInPrivateEu() {
		assertTrue(createMachine("eu-ams-1", "10.224", false, true));
	}

	@Test
	public void createInPublicUsEast() {
		assertTrue(createMachine("us-east-1", "165.225", true, false));
	}

	@Test
	public void createInPublicUsSw() {
		assertTrue(createMachine("us-sw-1", "199.192", true, false));
	}

	private boolean createMachine(String dataCenter, String ipRange,
			boolean inPublic, boolean inPrivate) {
		String instanceName = "selenide-created-instance";
		String os = "base";
		String version = "13.2.0";
		String packageType = "Standard";
		String packageSize = "Standard 0.25";
		$(byText("Compute")).click();
		instanceList = page(InstanceList.class);
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
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.selectInstanceType(packageType);
		createInstanceCarousel.selectPackage(packageSize);
		createInstanceCarousel.checkSelectedImageText("A 32-bit SmartOS");
		createInstanceCarousel.checkPackageInfo(dataCenter, "256 MB", "16 GB",
				"0.125 and bursting");
		createInstanceCarousel.checkPaymentInfo("0.008", "5.84");
		$(byText("Configure networks +")).shouldBe(visible);
		$(byText("Configure networks +")).click();
		$(byAttribute("name", "Joyent-SDC-Private")).shouldBe(visible);
		$(byAttribute("name", "Joyent-SDC-Public")).shouldBe(visible);
		if (inPublic)
			$(byAttribute("name", "Joyent-SDC-Public")).click();
		if (inPrivate)
			$(byAttribute("name", "Joyent-SDC-Private")).click();
		System.out.println(dataCenter
				+ " Public value: "
				+ $(byAttribute("name", "Joyent-SDC-Public")).getAttribute(
						"value"));
		System.out.println(dataCenter
				+ " Private value: "
				+ $(byAttribute("name", "Joyent-SDC-Private")).getAttribute(
						"value"));
		instanceName = createInstanceCarousel.setInstanceNameValue(instanceName);
		System.out.println(instanceName);
		instances.add(instanceName);
		$(byText("Create instance")).click();
		Common.confirmModal();
		$(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
		$(byText("Instances")).shouldBe(visible);
		instanceList = page(InstanceList.class);
		Common.errorNotPresent();
		$(byText(instanceName)).shouldBe(visible);
		instanceList.checkForCreatedInstance(instanceName);
		instanceList.checkInstanceStatus("Running", instanceName);
		$(byText(instanceName)).click();
		Common.checkHeadingText(instanceName);
		instancePage = page(InstancePage.class);
		instancePage.validateStatus("Running");
		if (instancePage.validateIP(dataCenter, ipRange))
			return true;
		else
			return false;

	}

}
