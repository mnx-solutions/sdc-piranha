package com.joyent.piranha.test.recentimageversion;

import com.codeborne.selenide.WebDriverRunner;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobject.instancedetails.FirewallSection;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.pageobject.instancedetails.MetadataSection;
import com.joyent.piranha.pageobject.instancedetails.TagSection;
import com.joyent.piranha.util.TestWrapper;
import com.joyent.piranha.utils.InstanceParser;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.Wait;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.Collection;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;
import static junit.framework.Assert.assertTrue;

@RunWith(Parameterized.class)
public class InstanceMainOperationsTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    private static InstanceVO instanceVO;
    private static SideBarMenu sideBarMenu;
    private static NavBarMenu navBarMenu;

    public InstanceMainOperationsTest(InstanceVO instanceVO) {
        InstanceMainOperationsTest.instanceVO = instanceVO;
        sideBarMenu.clickCompute();
        InstanceList instanceList = page(InstanceList.class);
        if ($("thead").exists()) {
            instanceList.openGridTab(PropertyHolder.getDatacenter(0));
            instanceList.deleteInstance(instanceList.getFirstInstanceName());
        }
        Instances instances = page(CreateInstanceManual.class).createInstance(instanceVO);
        instances.waitForInstanceRunning();
        instanceVO.setName(instanceList.getFirstInstanceName());
        System.out.println(instanceVO.getName());
    }

    @BeforeClass
    public static void begin() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PropertyHolder.getTestUserPassword());
        page(Dashboard.class).getFreeTierWidget().waitUntil(visible, timeout);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @Parameterized.Parameters
    public static Collection<Object> params() throws FileNotFoundException {
        Collection<InstanceVO> InstanceVOList = InstanceParser.getInstance(PropertyHolder.getDatacenter(0));
        Collection<Object> collection = new ArrayList<>();
        for (InstanceVO instanceVO : InstanceVOList) {
            collection.add(new Object[]{instanceVO});
        }
        return collection;
    }

    @AfterClass
    public static void deleteInstance() {
        Instances instances = sideBarMenu.clickCompute();
        if ($("thead").exists()) {
            InstanceList instanceList = instances.getInstanceList();
            instanceList.openGridTab(PropertyHolder.getDatacenter(0));
            instanceList.deleteInstance(instanceVO.getName());
        }
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void testInstanceFunctions() {
        //    rename Instance
        String instName = "NewInstName";
        InstanceList instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceList.openGridTab(PropertyHolder.getDatacenter(0));
        InstanceDetails instanceDetails = instanceList.openFirstInstanceDetails();
        instanceDetails.rename(instName);
        instanceDetails.getInstanceNameField().shouldHave(text(instName));
        sideBarMenu.clickCompute().getInstanceList().openInstanceDetails(instName);
        instanceDetails.rename(instanceVO.getName());
        instanceDetails.getInstanceNameField().shouldHave(text(instanceVO.getName()));

        //    check analytics
        // analytics is pretty unstable, easier to check manually for now
/*        instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceList.openGridTab(PropertyHolder.getDatacenter(0));
        instanceDetails = instanceList.openFirstInstanceDetails();
        Analytics analytics = instanceDetails.clickDetailedAnalytics();
        String metricsName = "CPU: aggregated CPU usage";
        analytics.selectMetrics(metricsName);
        analytics.getStartAnalyticsButton().click();

        final String cpuRepeater = "i in graphs";
        analytics.getGraphTitleElement(cpuRepeater, metricsName).shouldBe(visible);

        long i = 0;
        String q;
        while (i < 5) {
            q = getCoordinates(cpuRepeater);
            sleep(10000);
            Assert.assertNotEquals("CPU usage graph is stuck" + q + getCoordinates(cpuRepeater), getCoordinates(cpuRepeater), q);
            i++;
        }*/

        //    test tagging
        instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceList.openGridTab(PropertyHolder.getDatacenter(0));
        instanceDetails = instanceList.openFirstInstanceDetails();
        TagSection tagSection = instanceDetails.openTagsSection();
        String key = "test1";
        tagSection.addTag(key, key);
        tagSection.getTagRepeaterByKey(key).should(exist);
        tagSection.removeTag(key);
        tagSection.getTagRepeaterByKey(key).shouldNot(exist);

        //    test metadata
        instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceList.openGridTab(PropertyHolder.getDatacenter(0));
        instanceDetails = instanceList.openFirstInstanceDetails();
        MetadataSection metadataSection = instanceDetails.openMetadataSection();
        String testKey = "TestKey";
        metadataSection.addMetadata(testKey, "TestValue");
        metadataSection.getTagRepeaterByKey(testKey).should(exist);
        metadataSection.removeMetadata(testKey);
        metadataSection.getTagRepeaterByKey(testKey).shouldNot(exist);

        //    resize Instance
        // doesn't work due to PIRANHA-1930
/*
        instanceDetails = sideBarMenu.clickCompute().getInstanceList().openFirstInstanceDetails();
        instanceDetails.selectResizeOption("Mem: 512 MB Disk: 16 GB VCPU: 0.125 and bursting");
        instanceDetails.clickResizeButton();
        instanceDetails.clickButtonInModal("Yes");
        instanceDetails.waitForSmallSpinnerDisappear();
        instanceDetails.openSummarySection();
        assertTrue(instanceDetails.getMemory().equals("512 MB"));
*/

        //    enable disable Firewall
        Instances instances = sideBarMenu.clickCompute();
        instances.getInstanceList().selectInstance(instanceVO.getName());
        instances.performAction("Enable Firewall");
        instances.clickButtonInModal("Yes");
        Wait<WebDriver> wait = new WebDriverWait(WebDriverRunner.getWebDriver(), 10);
        wait.until(input -> {
            boolean b = false;
            if ($(".modal-header").isDisplayed() || $(".loading-small").isDisplayed()) {
                b = true;
            }
            return b;
        });
        if ($(".modal-header").isDisplayed()) {
            instances.clickButtonInModal("Ok");
        } else {
            instances.waitForSmallSpinnerDisappear();
            FirewallSection firewallSection = instances.getInstanceList().openInstanceDetails(instanceVO.getName()).openFirewallSection();
            firewallSection.getDisableButton().shouldBe(visible);
            firewallSection.clickDisableButton();
            firewallSection.waitForMediumSpinnerDisappear();
            firewallSection.getEnableButton().shouldBe(visible);
        }

        //    stop start reboot Instance
        instanceDetails = sideBarMenu.clickCompute().getInstanceList().openFirstInstanceDetails();
        instanceDetails.stopInstance();
        assertTrue(instanceDetails.getInstanceStatus().equals("stopped"));
        instanceDetails.startInstance();
        assertTrue(instanceDetails.getInstanceStatus().equals("running"));
        instanceDetails.rebootInstance();
        assertTrue(instanceDetails.getInstanceStatus().equals("running"));
        instanceDetails.deleteInstance();
    }

    private String getCoordinates(final String repeater) {
        return executeJavaScript("return $(\"[data-ng-repeat='" + repeater + "'] [class='x_tick plain']\")[3].getAttribute(\"style\")").toString();
    }
}
