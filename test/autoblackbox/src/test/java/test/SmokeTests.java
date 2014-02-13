package test;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selectors.withText;
import static com.codeborne.selenide.Selenide.$$;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.open;
import static com.codeborne.selenide.Selenide.page;

import org.junit.*;

import pageobjects.Common;
import pageobjects.CreateInstanceCarousel;
import pageobjects.InstanceList;
import util.TestWrapper;

import java.lang.String;
import java.lang.System;

public class SmokeTests extends TestWrapper {
    private InstanceList instanceList;

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;
        open("/");
        Common.login();
    }

    @AfterClass
    public static void logout() {
        open("/landing/forgetToken");
    }

    @After
    public void goToDashboard() {
        Common.errorNotPresent();
        Common.clickNavigationLink("Dashboard");
    }


    @Test
    public void dashboardIsVisible() {
        Common.clickNavigationLink("Dashboard");
        Common.checkHeadingText("Dashboard");
        $("#count-instances-running").shouldNotHave(text("0"));
        $(withText("DevCenter")).shouldBe(visible);
        $(withText("Support")).shouldBe(visible);
        $(withText("System Status")).shouldBe(visible);
    }

    @Test
    public void instanceListIsVible() {
        Common.clickNavigationLink("Compute");
        $(byText("Instances")).shouldBe(visible);
        $(".loading-large").waitUntil(disappear, BASE_TIMEOUT);
        $(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
        instanceList = page(InstanceList.class);
        instanceList.getFirtstInstanceName();
        $("#button-actions").click();
        $("#option-list-actions").shouldBe(visible);
        $("#button-columns").click();
        $("#checkbox-list-columns").shouldBe(visible);
    }

    @Test
    public void instanceAnalyticsIsVisible() {
        Common.clickNavigationLink("Compute");
        $(byText("Instances")).shouldBe(visible);
        Common.errorNotPresent();
        $(".loading-large").waitUntil(disappear, BASE_TIMEOUT);
        $(".loading-medium-after-h1").waitUntil(disappear, BASE_TIMEOUT);
        instanceList = page(InstanceList.class);
        String in = instanceList.getFirtstInstanceName();
        $(byText(in)).click();
        Common.checkHeadingText(in);
        $$(".detail_chart").shouldHaveSize(3);
        $("#button-detailed-analytics").click();
        $(byText("Select Instance:")).shouldBe(visible);
        $("#button-start").shouldBe(visible);
    }

    @Test
    public void storagePageIsVible() {
        Common.clickNavigationLink("Storage");
        Common.errorNotPresent();
        $(byText("Introduction")).shouldBe(visible);
    }

    @Test
    public void accountSummaryIsVisible() {
        Common.openMyAccount();
        Common.checkHeadingText("Account Summary");
        Common.checkSubHeadingText("Your Profile");
        Common.checkSubHeadingText("Billing Information");
        Common.checkSubHeadingText("SSH");
        $(".accordion-package-title").shouldHave(
                text("Key Name / UUID"));
        Common.openSubHeadingEditLink("Your Profile");
        Common.checkHeadingText("Edit Profile");
        Common.checkBreadcrumb("Account", "Edit Profile");
        Common.openMyAccount();
        Common.openSubHeadingEditLink("Billing Information");
        Common.checkBreadcrumb("Account", "Edit Billing Information");
        Common.checkHeadingText("Edit Billing Information");
        Common.openMyAccount();
        $(".key-name.ng-binding").click();
        $(byText("Fingerprint")).shouldBe(visible);
    }

    @Test
    public void createInstanceCarouselIsVisible() {
        String instanceName = "selenide-created-instance";
        String[] inst = Common.instanceProperties();
        $("#button-create-instance").click();
        Common.checkHeadingText("Quick Start: Create Instance");
        CreateInstanceCarousel createInstanceCarousel = page(CreateInstanceCarousel.class);
        createInstanceCarousel.waitUntilPageIsActive(0);
        createInstanceCarousel.selectDataCenter(System.getProperty("datacenter"));
        createInstanceCarousel.selectOsFilter("smartos");
        createInstanceCarousel.selectOsImage(inst[0]);
        createInstanceCarousel.waitUntilPageIsActive(1);
        createInstanceCarousel.selectPackage(inst[3]);
        CreateInstanceCarousel.clickReviewBtn();
        createInstanceCarousel.checkSelectedImageDescription(inst[4]);
        createInstanceCarousel.checkPackageInfo(inst[5], inst[6], inst[7], inst[3]);
        createInstanceCarousel.checkPaymentInfo(inst[8], inst[9]);
        createInstanceCarousel.setInstanceNameValue(instanceName);
        $(".checker").click();
        $(".create-instance-btn-pos").click();
        createInstanceCarousel.cancelInstanceCreation();
    }

    @Test
    public void logoutAndLogIn() {
        open("/landing/forgetToken");
        $(byText("Already a customer?")).shouldBe(visible);
        $(byText("New to Joyent?")).shouldBe(visible);
        $(byAttribute("type", "button")).click();
        $(byAttribute("name", "username")).setValue(System.getProperty("loginusr"));
        $(byAttribute("name", "password")).setValue("lol");
        $("#login-submit").click();
        $(".alert-error").shouldHave(text("Invalid username or password"));
        $("#login-submit").click();
        $(".alert-error").shouldHave(text("username and password are required"));
        $(byAttribute("name", "username")).setValue(System.getProperty("loginusr"));
        $(byAttribute("name", "password")).setValue(System.getProperty("loginpw"));
        $("#login-submit").click();
    }
}
