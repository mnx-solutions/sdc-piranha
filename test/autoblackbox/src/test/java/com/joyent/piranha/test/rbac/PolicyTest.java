package com.joyent.piranha.test.rbac;


import com.codeborne.selenide.SelenideElement;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.util.TestWrapper;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

public class PolicyTest extends TestWrapper {
    public static SideBarMenu sideBarMenu;
    public static NavBarMenu navBarMenu;
    public static Policies policies;

    @BeforeClass
    public static void openDashboard() {
        timeout = Long.parseLong(PropertyHolder.getGlobalTimeout());
        baseUrl = PropertyHolder.getBaseUrl();
        sideBarMenu = page(SideBarMenu.class);
        navBarMenu = page(NavBarMenu.class);
        Login loginPage = open("/", Login.class);
        loginPage.login(PropertyHolder.getTestUserLogin(), PropertyHolder.getTestUserPassword());
    }

    @Before
    public void openPolicies() {
        policies = sideBarMenu.clickPolicies();
        policies.waitForLargeSpinnerDisappear();
    }

    @AfterClass
    public static void cleanUp() throws InstantiationException, IllegalAccessException {
        sideBarMenu.clickPolicies();
        Common.cleanUpGrid(Policies.class);
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @Test
    public void createPolicyValidation() {
        CreatePolicy createPolicy = policies.clickCreatePolicy();
        createPolicy.clickCreatePolicy();
        $(".policy-form-error:not(.ng-hide)").waitUntil(exist, timeout);
        $(byText("Missing name")).shouldBe(visible);
        createPolicy.setName("!");
        $(".policy-form-error:not(.ng-hide)").waitUntil(exist, timeout);
        $(byText("Name can contain only letters, digits, spaces and signs like \".\" and \"-\"")).shouldBe(visible);
        createPolicy.setName("testPolicy");
        String role = "incorrectrole";
        createPolicy.addRule(role);
        createPolicy.clickCreatePolicy();
        assertTrue($(".modal").text().contains("Parse error on line 1:\n" + role));
        createPolicy.clickButtonInModal("Ok");
        createPolicy.deleteRule(role);
    }

    @Test
    public void createPolicy() {
        String policyName = policies.createTestPolicy();
        $(Policies.grid).$(byText(policyName)).shouldBe(visible);
    }

    @Test
    public void changePolicyInformation() {
        String policyName = policies.createTestPolicy();
        PolicyDetails policyDetails = policies.openPolicyDetails(policyName);
        String newPolicyName = "newPolicyName" + System.currentTimeMillis();
        policyDetails.setName(newPolicyName);
        String role = "can testrole " + System.currentTimeMillis();
        policyDetails.addRule(role);
        policyDetails.clickSave();
        policyDetails.waitForLargeSpinnerDisappear();
        String rowText = policies.getRowByText("object in pagedItems", newPolicyName).text();
        assertTrue(rowText.contains(role));
    }

    @Test
    public void deletePolicy() {
        String policyName = policies.createTestPolicy();
        PolicyDetails policyDetails = policies.openPolicyDetails(policyName);
        policyDetails.clickDelete();
        policyDetails.clickButtonInModal("Yes");
        $(Policies.grid).$(byText(policyName)).shouldNot(exist);
    }

    @Test
    public void deletePolicyFromGrid() {
        String policyName = policies.createTestPolicy();
        SelenideElement row = policies.getRowByText("object in pagedItems", policyName);
        row.$(".checkbox").click();
        policies.performAction("Delete");
        policies.clickButtonInModal("Yes");
        policies.waitForLargeSpinnerDisappear();
        $(Policies.grid).$(byText(policyName)).shouldNot(exist);
    }
}