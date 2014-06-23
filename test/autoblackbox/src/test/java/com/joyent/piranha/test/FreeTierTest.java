package com.joyent.piranha.test;

import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobject.CreateInstanceQuickStart;
import com.joyent.piranha.pageobject.InstanceList;
import com.joyent.piranha.pageobject.Instances;
import com.joyent.piranha.util.TestWrapper;
import org.json.JSONException;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;

import java.io.IOException;
import java.text.ParseException;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;
import static org.junit.Assert.assertTrue;

public class FreeTierTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    public static final String DATACENTER = PropertyHolder.getDatacenter(1);
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;
    private static Dashboard dashboard;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        dashboard = page(Dashboard.class);
        dashboard.getFreeTierWidget().shouldBe(visible);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
    }

    @AfterClass
    public static void logout() {
        final InstanceList instanceList = page(InstanceList.class);
        sideBarMenu.clickCompute().getInstanceList().deleteInstance(instanceList.getFirstInstanceName());
        instanceList.waitForSmallSpinnerDisappear();
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void createFreeInstance() throws IOException, JSONException, ParseException {
        dashboard.getFreeTierWidget().shouldBe(visible);
        CreateInstanceQuickStart createInstance = dashboard.clickCreateFreeTier();
        createInstance.selectDataCenter(DATACENTER);
        createInstance.waitForMediumSpinnerDisappear();
        final String imageName = "TestFree";
        String checkThisDate = createInstance.getFreeTierInfo(imageName);
        String freeTierEndDate = Common.addOneYearToDate(Common.getUserCreateDate(DATACENTER));
        assertFreeTierEndDate(freeTierEndDate, checkThisDate);
        Instances instances = createInstance.clickLaunchButton(imageName);
        InstanceList instanceList = instances.getInstanceList();
        String freeTier = instanceList.getFirstInstanceName();
        instances.waitForSmallSpinnerDisappear();
        assertTrue(dashboard.getRowByText("object in pagedItems", freeTier).getText().contains("*"));
        dashboard = sideBarMenu.clickDashboard();
        assertTrue(dashboard.checkForFreeTierInDatacenter(DATACENTER));
        assertTrue(dashboard.getFreeTierTooltipText(DATACENTER).contains(freeTier));
        checkThisDate = dashboard.getFreeTierWidget().$(".more").getText();
        assertFreeTierEndDate(freeTierEndDate, checkThisDate);
        instances = sideBarMenu.clickCompute();
        checkThisDate = instances.getFooterText();
        assertFreeTierEndDate(freeTierEndDate, checkThisDate);
    }

    public void assertFreeTierEndDate(String freeTierEndDate, String checkThisDate) {
        assertTrue(checkThisDate.contains(freeTierEndDate));
    }
}
