package test;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.*;
import static com.codeborne.selenide.Selenide.*;
import static com.codeborne.selenide.WebDriverRunner.getWebDriver;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Ignore;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TestName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import com.saucelabs.common.SauceOnDemandSessionIdProvider;
import com.saucelabs.junit.SauceOnDemandTestWatcher;

import data.CreateInstanceObject;
import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import pageobjects.InstancePage;
import util.Common;
import util.SauceAuthentication;

public class InstanceManipulationTests implements
		SauceOnDemandSessionIdProvider {
	private static final String BASE_URL = System.getProperty("endpoint");
	private static final int BASE_TIMEOUT = Integer.parseInt(System
			.getProperty("globaltimeout", "15000"));
	private static final int CHANGE_STATUS_TIMEOUT = Integer.parseInt(System
			.getProperty("statustimeout", "240000"));

	private static InstanceList instanceList;
	private InstancePage instancePage;

	private static CreateInstanceObject i1 = new CreateInstanceObject(
			"selenide-created-instance-a", "13.2.0", "base", null, null,
			"Standard 0.25", null, "0.008", "5.84");
	private static CreateInstanceObject i2 = new CreateInstanceObject(
			"selenide-created-instance-b", "13.2.0", "base", null, null,
			"Standard 0.25", null, "0.008", "5.84");

	// Sauce test watcher start

	SauceAuthentication sa = new SauceAuthentication();
	private static WebDriver driver = getWebDriver();
	private static String sessionId;
	public @Rule
	TestName testName = new TestName();
	public @Rule
	SauceOnDemandTestWatcher resultReportingTestWatcher = new SauceOnDemandTestWatcher(
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
		generateTestInstances();
	}

	@Before
	public void goToDashboard() {
		open("/main/#!/dashboard");
	}

	@AfterClass
	public static void deleteGeneratedInstances() {
		try {
			open("/main/#!/dashboard");
			open("/main/#!/compute");
			Common.checkHeadingText("Instances");
			instanceList = page(InstanceList.class);
			$(byText(i1.getImageName())).shouldBe(visible);
			$(byText(i2.getImageName())).shouldBe(visible);
			instanceList.toggleInstanceControl(i1.getImageName());
			instanceList.toggleInstanceControl(i2.getImageName());
			instanceList.changeInstanceStatus("Stop", i1.getImageName());
			instanceList.changeInstanceStatus("Stop", i2.getImageName());
			instanceList.checkInstanceStatus("Stopped", i1.getImageName());
			instanceList.checkInstanceStatus("Stopped", i2.getImageName());
			instanceList.deleteInstance(i1.getImageName());
			Common.errorNotPresent();
			instanceList.deleteInstance(i2.getImageName());
			Common.errorNotPresent();
			$(byText(i1.getImageName())).shouldNot(exist);
			$(byText(i2.getImageName())).shouldNot(exist);
		} finally {
			open("/landing/forgetToken");
		}
	}

	@Test
	public void tagOpetationTests() {
		open("/main/#!/compute");
		Common.checkHeadingText("Instances");
		InstanceList.waitForInstanceList();
		String instanceName = i1.getImageName();
		$(byText(instanceName)).click();
		Common.checkHeadingText(instanceName);
		instancePage = page(InstancePage.class);
		instancePage.addTag("tagName1", "tagValue1");
		instancePage.addTag("tagName2", "tagValue2");
		instancePage.removeTag("tagName1");
		instancePage.addTag("tagName1", "tagValue1");
		instancePage.saveInstance();
		Common.errorNotPresent();
		assertTrue(instancePage.hasTag("tagName1", "tagValue1"));
		assertFalse(instancePage.hasTag("tagName", "tagValue1"));
		assertFalse(instancePage.hasTag("tagName1", "tagValue"));
		instancePage.removeTag("tagName1");
		instancePage.removeTag("tagName2");
		assertFalse(instancePage.hasTag("tagName1", "tagValue1"));
		assertFalse(instancePage.hasTag("tagName2", "tagValue2"));
		instancePage.saveInstance();
		Common.errorNotPresent();
	}

	@Test
	public void restartBothMachines() {
		String i1Name = i1.getImageName();
		String i2Name = i2.getImageName();
		open("/main/#!/compute");
		Common.checkHeadingText("Instances");
		instanceList = page(InstanceList.class);
		instanceList.toggleInstanceControl(i1Name);
		instanceList.changeInstanceStatus("Reboot", i1Name);
		Common.errorNotPresent();
		$(byText(i2Name)).click();
		Common.checkHeadingText(i2Name);
		instancePage = page(InstancePage.class);
		instancePage.reboot();
		Common.errorNotPresent();
		Common.clickNavigationLink("Compute");
		instanceList = page(InstanceList.class);
		instanceList.checkInstanceStatus("Running", i1Name);
		instanceList.checkInstanceStatus("Running", i2Name);
		Common.errorNotPresent();
	}

	@Test
	public void resizeBothMachines() {
		String i1Name = i1.getImageName();
		String i2Name = i2.getImageName();
		open("/main/#!/compute");
		Common.checkHeadingText("Instances");
		$(byText(i1Name)).click();
		Common.checkHeadingText(i1Name);
		instancePage = page(InstancePage.class);
		instancePage.resize("g3-standard-0.5-smartos");
		Common.errorNotPresent();
		Common.clickNavigationLink("Compute");
		Common.errorNotPresent();
		$(byText(i2Name)).click();
		Common.checkHeadingText(i2Name);
		instancePage = page(InstancePage.class);
		instancePage.resize("g3-standard-1-smartos");
		Common.errorNotPresent();
		Common.clickNavigationLink("Compute");
		instanceList.checkInstanceStatus("Running", i1Name);
		instanceList.checkInstanceStatus("Running", i2Name);
		Common.errorNotPresent();
	}

	@Test
	public void renameInstancesAndStartStopThem() {
		String i1Name = i1.getImageName();
		String i2Name = i2.getImageName();
		i1.setImageName(i1Name + "-r");
		i2.setImageName(i2Name + "-r");
		open("/main/#!/compute");
		Common.checkHeadingText("Instances");
		$(byText(i1Name)).click();
		Common.checkHeadingText(i1Name);
		instancePage = page(InstancePage.class);
		instancePage.rename(i1.getImageName());
		Common.errorNotPresent();
		Common.clickNavigationLink("Compute");
		$(byText(i2Name)).click();
		Common.checkHeadingText(i2Name);
		instancePage = page(InstancePage.class);
		instancePage.stop();
		instancePage.validateStatus("Stopped");
		instancePage.rename(i2.getImageName());
		Common.errorNotPresent();
		Common.clickNavigationLink("Compute");
		$(byText(i1.getImageName())).shouldBe(visible);
		$(byText(i2.getImageName())).waitUntil(visible, CHANGE_STATUS_TIMEOUT);
		instanceList.checkInstanceStatus("Running", i1.getImageName());
		instanceList.checkInstanceStatus("Stopped", i2.getImageName());
		instanceList.toggleInstanceControl(i2.getImageName());
		instanceList.changeInstanceStatus("Start", i2.getImageName());
		instanceList.checkInstanceStatus("Running", i2.getImageName());
		Common.errorNotPresent();
	}

	@Test
	public void searchForInstances() {
		open("/main/#!/compute");
		Common.checkHeadingText("Instances");
		$("#search").setValue("selenide-created-instance-");
		$(byText(i1.getImageName())).shouldBe(visible);
	}

	public static void generateTestInstances() {
		String i1Name = i1.getImageName();
		String i2Name = i2.getImageName();
		$(byText("Create Instance")).click();
		Common.checkHeadingText("Create Instance");
		i1Name = CreateInstanceCarousel.createIsntance(i1);
		$(byText("Create Instance")).click();
		i2Name = CreateInstanceCarousel.createIsntance(i2);
		i1.setImageName(i1Name);
		i2.setImageName(i2Name);
		instanceList = page(InstanceList.class);
		$(byText(i1Name)).shouldBe(visible);
		$(byText(i2Name)).shouldBe(visible);
		instanceList.checkForCreatedInstance(i1.getImageName());
		instanceList.checkForCreatedInstance(i2.getImageName());
		instanceList.checkInstanceStatus("Running", i1.getImageName());
		instanceList.checkInstanceStatus("Running", i2.getImageName());
	}
}