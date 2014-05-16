package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.*;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class FakePackageTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    private static NavBarMenu navBarMenu;
    public static SideBarMenu sideBarMenu;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PropertyHolder.getTestUserPassword());
        page(Dashboard.class).getCountInstancesRunning().shouldNotHave(text("0"));
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @AfterClass
    public static void endClass() {
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void selectHighPerformancePackage() {
        CreateInstanceQuickStart createInstanceQuickStart = sideBarMenu.clickDashboard().clickCreateComputeInstance();
        CreateInstance createInstance = createInstanceQuickStart.clickViewMoreImages();
        createInstance.waitForMediumSpinnerDisappear();
        createInstance.selectOsFilter("smartos");
        createInstance.selectOsImage("base");
        createInstance.filterPackages("VCPUS", "32 vCPUs");
        createInstance.openSection("High CPU");
        createInstance.selectPackage("High CPU 32");
        Zenbox zenbox = createInstance.clickReviewBtn("fakePackage");
        $("#dropbox").shouldBe(visible);
        assertTrue(zenbox.getQuestionInput().val().equals("I want to order High CPU-CC 32 GB RAM 32 vCPUs 1200 GB Disk compute instance"));
        assertTrue(zenbox.getNameInput().val().equals(USER_NAME));
        zenbox.closeDialog();
    }

    @Test
    public void resizeInstanceHighPerformance() {
        InstanceDetails instanceDetails = sideBarMenu.clickCompute().getInstanceList().openInstanceDetails(Common.getTestInstanceName());
        String instanceId = instanceDetails.getInstanceId();
        instanceDetails.selectResizeOption("Mem: 128 GB Disk: 4200 GB VCPU: 32 and bursting");
        Zenbox zenbox = instanceDetails.clickResizeButton("fakePackage");
        assertTrue(zenbox.getQuestionInput().val().equals("I want to resize instance " + instanceId));
        assertTrue(zenbox.getNameInput().val().equals(USER_NAME));
        zenbox.closeDialog();
    }
}
