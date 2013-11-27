package test;

import static com.codeborne.selenide.Condition.disappear;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import pageobjects.Common;
import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import pageobjects.InstancePage;
import util.TestWrapper;

public class NetworkTests extends TestWrapper {

	private CreateInstanceCarousel createInstanceCarousel;
	private static InstanceList instanceList;
	private InstancePage instancePage;
	private static List<String> instances;

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
		assertTrue(createMachine("us-east-1", "72.2", true, false));
	}

	@Test
	public void createInPublicUsSw() {
		assertTrue(createMachine("us-sw-1", "165.225", true, false));
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
		createInstanceCarousel.selectDataCenter(dataCenter);
		createInstanceCarousel.selectOsFilter("smartos");
		createInstanceCarousel.setOsVersion(os, version);
		createInstanceCarousel.selectOsImage(os);
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.selectInstanceType(packageType);
		createInstanceCarousel.selectPackage(packageSize);
		createInstanceCarousel
				.checkSelectedImageDescription("A 32-bit SmartOS");
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
		instanceName = createInstanceCarousel
				.setInstanceNameValue(instanceName);
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
