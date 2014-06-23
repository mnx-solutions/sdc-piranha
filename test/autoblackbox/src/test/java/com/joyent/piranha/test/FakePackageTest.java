package com.joyent.piranha.test;

import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.text;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;
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
        CreateInstanceManual createInstanceManual = sideBarMenu.clickDashboard().clickCreateComputeInstance();
        createInstanceManual.waitForMediumSpinnerDisappear();
        createInstanceManual.clickAllPublicImagesLink();
        createInstanceManual.selectOsFilter("smartos");
        createInstanceManual.chooseImage("base");
        createInstanceManual.filterPackages("VCPUS", "32 vCPUs");
        createInstanceManual.openSection("High CPU");
        createInstanceManual.selectPackage("High CPU 32");
        Zenbox zenbox = createInstanceManual.clickReviewBtn("fakePackage");
        $("#dropbox").shouldBe(visible);
        assertTrue(zenbox.getQuestionInput().val().equals("I want to order High CPU-CC 32 GB RAM 32 vCPUs 1200 GB Disk compute instance"));
        assertTrue(zenbox.getNameInput().val().equals(USER_NAME));
        zenbox.closeDialog();
    }

    @Test
    public void resizeInstanceHighPerformance() {
        InstanceList instanceList = sideBarMenu.clickCompute().getInstanceList();
         InstanceDetails instanceDetails= instanceList.openInstanceDetails(instanceList.getFirstInstanceName());
        String instanceId = instanceDetails.getInstanceId();
        instanceDetails.selectResizeOption("Mem: 128 GB Disk: 4200 GB VCPU: 32 and bursting");
        Zenbox zenbox = instanceDetails.clickResizeButton("fakePackage");
        assertTrue(zenbox.getQuestionInput().val().equals("I want to resize instance " + instanceId));
        assertTrue(zenbox.getNameInput().val().equals(USER_NAME));
        zenbox.closeDialog();
    }
}
