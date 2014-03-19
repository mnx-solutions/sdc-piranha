package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.pageobject.InstanceList;
import com.joyent.piranha.pageobjects.CreateInstanceCarousel;
import com.joyent.piranha.pageobjects.InstancePage;
import com.joyent.piranha.util.TestWrapper;
import com.joyent.piranha.vo.CreateInstanceObject;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.disappears;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;

public class InstanceCRUDTests extends TestWrapper {

    private static InstanceList instanceList;
    private InstancePage instancePage;

    private static CreateInstanceObject i1 = new CreateInstanceObject(
            "selenide-created-instance-a", "13.2.0", "base", "Standard 0.25",
            "0.008", "5.84");
    private static CreateInstanceObject i2 = new CreateInstanceObject(
            "selenide-created-instance-b", "13.2.0", "base", "Standard 0.25",
            "0.008", "5.84");
    private static String dc1 = "us-east-1";
    private static String dc2 = "us-west-1";

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
            $(byText(i1.getInstanceName())).shouldBe(visible);
            $(byText(i2.getInstanceName())).shouldBe(visible);
            instanceList.toggleInstanceControl(i1.getInstanceName());
            instanceList.toggleInstanceControl(i2.getInstanceName());
            instanceList.changeInstanceStatus("Stop", i1.getInstanceName());
            instanceList.changeInstanceStatus("Stop", i2.getInstanceName());
            instanceList.checkInstanceStatus("Stopped", i1.getInstanceName());
            instanceList.checkInstanceStatus("Stopped", i2.getInstanceName());
            instanceList.deleteInstance(i1.getInstanceName());
            Common.errorNotPresent();
            instanceList.deleteInstance(i2.getInstanceName());
            Common.errorNotPresent();
            $(byText(i1.getInstanceName())).waitUntil(disappears,
                    CHANGE_STATUS_TIMEOUT);
            $(byText(i2.getInstanceName())).waitUntil(disappears,
                    CHANGE_STATUS_TIMEOUT);
        } finally {
            open("/landing/forgetToken");
        }
    }

    @Test
    public void validateMachinePageInfo() {
        Common.clickNavigationLink("Compute");
        $(byText(i1.getInstanceName())).click();
        instancePage = page(InstancePage.class);
        instancePage.validateInstanceSpecs("smartmachine",
                i1.getInstanceName(), i1.getImageOs(), i1.getImageVersion(),
                "", "", "", "", "", "");
    }

    @Test
    public void restartBothMachines() {
        String i1Name = i1.getInstanceName();
        String i2Name = i2.getInstanceName();
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
        String i1Name = i1.getInstanceName();
        String i2Name = i2.getInstanceName();
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
        String i1Name = i1.getInstanceName();
        String i2Name = i2.getInstanceName();
        i1.setInstanceName(i1Name + "-r");
        i2.setInstanceName(i2Name + "-r");
        open("/main/#!/compute");
        Common.checkHeadingText("Instances");
        $(byText(i1Name)).click();
        Common.checkHeadingText(i1Name);
        instancePage = page(InstancePage.class);
        InstancePage.rename(i1.getInstanceName());
        Common.errorNotPresent();
        Common.clickNavigationLink("Compute");
        $(byText(i2Name)).click();
        Common.checkHeadingText(i2Name);
        instancePage = page(InstancePage.class);
        instancePage.stop();
        instancePage.validateStatus("Stopped");
        InstancePage.rename(i2.getInstanceName());
        Common.errorNotPresent();
        Common.clickNavigationLink("Compute");
        $(byText(i1.getInstanceName())).shouldBe(visible);
        $(byText(i2.getInstanceName())).waitUntil(visible,
                CHANGE_STATUS_TIMEOUT);
        instanceList = page(InstanceList.class);
        instanceList.checkInstanceStatus("Running", i1.getInstanceName());
        instanceList.checkInstanceStatus("Stopped", i2.getInstanceName());
        instanceList.toggleInstanceControl(i2.getInstanceName());
        instanceList.changeInstanceStatus("Start", i2.getInstanceName());
        instanceList.checkInstanceStatus("Running", i2.getInstanceName());
        Common.errorNotPresent();
    }

    @Test
    public void searchForInstances() {
        open("/main/#!/compute");
        Common.checkHeadingText("Instances");
        $("#search").setValue("selenide-created-instance-");
        $(byText(i1.getInstanceName())).shouldBe(visible);
    }

    public static void generateTestInstances() {
        String i1Name;
        String i2Name;
        $(byText("Create Instance")).click();
        Common.checkHeadingText("Create Instance");
        i1Name = CreateInstanceCarousel.createInstance(i1, dc1);
        $(byText("Create Instance")).click();
        i2Name = CreateInstanceCarousel.createInstance(i2, dc2);
        i1.setInstanceName(i1Name);
        i2.setInstanceName(i2Name);
        instanceList = page(InstanceList.class);
        $(byText(i1Name)).shouldBe(visible);
        $(byText(i2Name)).shouldBe(visible);
        instanceList.checkForCreatedInstance(i1.getInstanceName());
        instanceList.checkForCreatedInstance(i2.getInstanceName());
        instanceList.checkInstanceStatus("Running", i1.getInstanceName());
        instanceList.checkInstanceStatus("Running", i2.getInstanceName());
    }
}