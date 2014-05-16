package com.joyent.piranha;

import com.codeborne.selenide.ElementsCollection;
import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import org.apache.commons.io.IOUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.NoSuchElementException;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Scanner;
import java.util.Set;

import static com.codeborne.selenide.Condition.*;
import static com.codeborne.selenide.Selectors.byAttribute;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.*;
import static org.junit.Assert.assertTrue;

/**
 * Common interaction methods for UI elements
 */
public class Common {

    private static final int BASE_TIMEOUT = Integer.parseInt(PropertyHolder.getGlobalTimeout());

    public static void login() {
        $(byAttribute("type", "button")).click();
        $(byAttribute("name", "username")).setValue(PropertyHolder.getTestUserLogin());
        $(byAttribute("name", "password")).setValue(PropertyHolder.getTestUserPassword());
        $("#login-submit").click();
        $("#count-instances-running").waitWhile(hasText("0"), BASE_TIMEOUT);
    }

    public static void checkSubHeadingText(String headingText) {
        ElementsCollection headingTextContainer = $$("legend");
        assertTrue(Common.getRowByText(headingTextContainer, headingText).exists());
    }

    @Deprecated
    public static SelenideElement getRowByText(ElementsCollection col, String filter) {
        for (SelenideElement element : col) {
            if (element.findAll(byText(filter)).size() > 0) {
                return element;
            }
        }
        throw new NoSuchElementException("Such element doesn't exist");
    }

    public static void checkHeadingText(String headingText) {
        $(".page-title").shouldHave(matchText("(.*)" + headingText + "(.*)"));
    }

    public static void clickNavigationLink(String text) {
        $(byText(text)).click();
    }

    public static void clickButtonInModal(String buttonName) {
        $(".modal").shouldBe(visible);
        $(".modal-header").exists();
        $(".modal-footer").find(byText(buttonName)).click();
    }

    public static void errorNotPresent() {
        if ($(".alert-error").isDisplayed()) {
            System.out.println($(".alert-error").text());
        }
    }

    public static String[] instanceProperties() {
        if (PropertyHolder.containsDatacenter(0,"us-west-b","local-x")) {
            return new String[]{
                    "base",
                    "13.3.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 vCPUs",
                    "$0.008",
                    "$5.84"};
        } else if (PropertyHolder.containsDatacenter(0, "us-west-1")) {
            return new String[]{
                    "base",
                    "13.2.0",
                    "Standard",
                    "Standard 0.25",
                    "A 32-bit SmartOS",
                    "256 MB",
                    "16 GB",
                    "0.125 and bursting",
                    "0.008",
                    "5.84"};
        }
        return new String[]{};
    }

    public static String getTestInstanceName() {
        final String instanceName;
        switch (PropertyHolder.getDatacenter(0)) {
            case "us-west-b":
            case "local-x":
                instanceName = "dnd-forImageAutoTests";
                break;
            default:
                instanceName = " ";
        }
        return instanceName;
    }

    public static String getSLBTestInstance() {
        return "dnd-forSLBTests";
    }

    public static String getValueFromLog(String key) throws FileNotFoundException, JSONException {
        File log = new File(PropertyHolder.getServerLogPath());
        String result = null;
        Scanner scanner = new Scanner(log);
        while (scanner.hasNext()) {
            String line = scanner.nextLine();
            if (line.contains(key)) {
                JSONObject newJson = new JSONObject(line);
                result = newJson.get(key).toString();
            }
        }
        return result;
    }

    public static void forceLogout() {
        open("/landing/forgetToken");
    }

    public static void switchWindow(SelenideElement elementToBeVisible) {
        Set<String> windows = WebDriverRunner.getWebDriver().getWindowHandles();
        for (String window1 : windows) {
            WebDriverRunner.getWebDriver().switchTo().window(window1);
            if (elementToBeVisible.isDisplayed()) {
                return;
            }
        }
    }

    public static String addOneYearToDate(String date) throws ParseException, IOException, JSONException {
        SimpleDateFormat userDate = new SimpleDateFormat("yyyy-MM-dd");
        Calendar calendar = Calendar.getInstance();
        calendar.setTime(userDate.parse(date));
        calendar.add(Calendar.YEAR, 1);
        return userDate.format(calendar.getTime());
    }

    public static String getUserCreateDate(String datacenter) throws IOException, JSONException {
        String userName = PropertyHolder.getTestUserLogin();
        ProcessBuilder processBuilder = new ProcessBuilder(PropertyHolder.getSdcPath() + "sdc-getaccount", "--" + userName + "");
        processBuilder.environment().put("SDC_ACCOUNT", userName);
        processBuilder.environment().put("SDC_KEY_ID", PropertyHolder.getSdcKeyID());
        processBuilder.environment().put("SDC_URL", PropertyHolder.getSdcURL(datacenter));
        processBuilder.environment().put("SDC_TESTING", "true");
        Process p = processBuilder.start();
        JSONObject outJSON = new JSONObject(IOUtils.toString(p.getInputStream()));
        return outJSON.get("created").toString().substring(0, 10);
    }
}
