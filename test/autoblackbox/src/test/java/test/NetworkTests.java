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
import java.util.HashMap;
import java.util.List;

import org.junit.After;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import com.codeborne.selenide.ex.ElementNotFound;

import data.CreateInstanceObject;
import pageobjects.Common;
import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import pageobjects.InstancePage;
import util.TestWrapper;

public class NetworkTests extends TestWrapper {

	private static CreateInstanceCarousel createInstanceCarousel;
	private static InstanceList instanceList;
	private InstancePage instancePage;
	private static List<CreateInstanceObject> instances;
	private static HashMap<String, String> networkIps;

	@BeforeClass
	public static void openDashboard() {
		timeout = BASE_TIMEOUT;
		baseUrl = BASE_URL;
		instances = new ArrayList<CreateInstanceObject>();
		networkIps = new HashMap<String, String>();
		open("/");
		Common.login();
		addInstancesToInstancesList();
		addNetworkIps();
		createInstances();
	}

	@AfterClass
	public static void logout() {
		deleteInstances();
		open("/landing/forgetToken");
	}

	@After
	public void goToDashboard() {
		Common.clickNavigationLink("Compute");
	}

	@Test
	public void createInPrivateUsWest() {
		assertTrue(checkInstance(getCreateInstanceObjectByName("private-us-west")));
	}

	@Test
	public void createInPrivateEu() {
		assertTrue(checkInstance(getCreateInstanceObjectByName("private-eu-ams")));
	}

	@Test
	public void createInPublicUsEast() {
		assertTrue(checkInstance(getCreateInstanceObjectByName("public-us-east")));
	}

	@Test
	public void createInPublicUsSw() {
		assertTrue(checkInstance(getCreateInstanceObjectByName("public-us-sw")));
	}

	private static void createInstance(CreateInstanceObject cio) {
		String instanceName = cio.getInstanceName();
		String os = cio.getImageOs();
		String version = cio.getImageVersion();
		String packageSize = cio.getPackageDisplayedName();
		String dc = cio.getDataCenter();
		boolean inPublic = cio.isInPublic();
		boolean inPrivate = cio.isInPrivate();
		$(byText("Compute")).click();
		instanceList = page(InstanceList.class);
		$(byText("Create Instance")).click();
		Common.checkHeadingText("Create Instance");
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.waitUntilPageIsActive(0);
		createInstanceCarousel.selectDataCenter(dc);
		createInstanceCarousel.setOsVersion(os, version);
		createInstanceCarousel.selectOsImage(os);
		createInstanceCarousel.waitUntilPageIsActive(1);
		createInstanceCarousel = page(CreateInstanceCarousel.class);
		createInstanceCarousel.selectPackage(packageSize);
		$(byText("Configure networks +")).shouldBe(visible);
		$(byText("Configure networks +")).click();
		$(byAttribute("name", "Joyent-SDC-Private")).shouldBe(visible);
		$(byAttribute("name", "Joyent-SDC-Public")).shouldBe(visible);
		if (inPublic)
			$(byAttribute("name", "Joyent-SDC-Public")).click();
		if (inPrivate)
			$(byAttribute("name", "Joyent-SDC-Private")).click();
		instanceName = createInstanceCarousel
				.setInstanceNameValue(instanceName);
		updateInstanceNameInList(cio.getInstanceName(), instanceName);
		$(byText("Create instance")).click();
		Common.confirmModal();
	}

	private static void updateInstanceNameInList(String instanceName,
			String newInstanceName) {
		for (CreateInstanceObject cio : instances) {
			if (cio.getInstanceName().equals(instanceName))
				cio.setInstanceName(newInstanceName);
		}
	}

	private boolean checkInstance(CreateInstanceObject cio) {
		String instanceName = cio.getInstanceName();
		String dataCenter = cio.getDataCenter();
		String prefix = setPrefix(instanceName);
		String ipRange = networkIps.get(dataCenter + prefix);
		$(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
		$(byText("Instances")).shouldBe(visible);
		instanceList = page(InstanceList.class);
		$(byText(instanceName)).shouldBe(visible);
		if (!instanceList.isRunning(instanceName)) {
			instanceList.checkForCreatedInstance(instanceName);
		}
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

	private String setPrefix(String instanceName) {
		String prefix = "";
		if (instanceName.startsWith("private-")) {
			prefix = "-private";
		}
		if (instanceName.startsWith("public-")) {
			prefix = "-public";
		}
		return prefix;
	}

	private CreateInstanceObject getCreateInstanceObjectByName(String name) {
		for (CreateInstanceObject cio : instances) {
			if (cio.getInstanceName().equals(name))
				return cio;
		}
		return null;
	}

	private static void deleteInstances() {
		$(byText("Compute")).click();
		instanceList = page(InstanceList.class);
		for (CreateInstanceObject instance : instances) {
			String instanceName = instance.getInstanceName();
			try {
				System.out.println("Stopping: " + instanceName);
				instanceList.toggleInstanceControl(instanceName);
				Common.errorNotPresent();
				instanceList.changeInstanceStatus("Stop", instanceName);
				Common.errorNotPresent();
			} catch (ElementNotFound e) {
			}
		}
		for (CreateInstanceObject instance : instances) {
			String instanceName = instance.getInstanceName();
			try {
				instanceList.checkInstanceStatus("Stopped", instanceName);
				System.out.println("Deleting: " + instanceName);
				Common.errorNotPresent();
				instanceList.deleteInstance(instanceName);
				Common.errorNotPresent();
			} catch (ElementNotFound e) {
			}
		}
	}

	private static void createInstances() {
		for (CreateInstanceObject cio : instances) {
			try {
				createInstance(cio);
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	private static void addNetworkIps() {
		networkIps.put("us-west-1-private", "10.12");
		networkIps.put("eu-ams-1-private", "10.224");
		networkIps.put("us-east-1-public", "72.2");
		networkIps.put("us-sw-1-public", "165.225");
	}

	private static void addInstancesToInstancesList() {
		instances.add(new CreateInstanceObject("private-us-west", "13.2.0",
				"base", "smartos", "Standard 0.25", "us-west-1", false, true));
		instances.add(new CreateInstanceObject("private-eu-ams", "13.2.0",
				"base", "smartos", "Standard 0.25", "eu-ams-1", false, true));
		instances.add(new CreateInstanceObject("public-us-east", "13.2.0",
				"base", "smartos", "Standard 0.25", "us-east-1", true, false));
		instances.add(new CreateInstanceObject("public-us-sw", "13.2.0",
				"base", "smartos", "Standard 0.25", "us-sw-1", true, false));
	}

}
